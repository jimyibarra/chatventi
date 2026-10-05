import 'server-only'
import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { describeSubscriptionItems, getStripe } from '@/lib/stripe'

// =====================================================================
// Ingreso y conciliación con Stripe (fuente de verdad del cobro).
//
//   · MRR: lo que factura cada suscripción viva, SIN IVA y con su descuento,
//     llevado a un mes (el anual entre 12), en la moneda en que se cobra.
//     Cuenta 'active' y 'past_due' (sigue facturando). No cuenta prueba,
//     'unpaid' ni canceladas.
//   · Cobrado en el mes: facturas pagadas este mes, sin IVA.
//   · Conciliación: cada suscripción de Stripe contra la fila del negocio en
//     ChatVenti (estado, plan y moneda). Lo que no cuadra se lista.
// =====================================================================

export type Money = { usd: number; mxn: number }

export type Reconciliation = {
  orgId: string | null
  orgName: string
  subscriptionId: string
  stripeStatus: string
  appStatus: string | null
  stripePlan: string | null
  appPlan: string | null
  currency: string
  /** Lo que factura al mes, sin IVA. 0 si no está viva. */
  monthly: number
  issues: string[]
}

export type StripeSnapshot = {
  mode: 'test' | 'live'
  mrr: Money
  paidThisMonth: Money
  /** Una fila por suscripción de Stripe relevante (viva, o referida por ChatVenti). */
  rows: Reconciliation[]
  /** Mensual por negocio (para la lista de organizaciones). */
  monthlyByOrg: Map<string, { amount: number; currency: string }>
  error?: string
}

const LIVE = new Set(['active', 'past_due'])
const round2 = (n: number) => Math.round(n * 100) / 100

/** Importe de un renglón en la moneda de la suscripción (precios con currency_options). */
async function itemAmount(stripe: Stripe, price: Stripe.Price, currency: string, cache: Map<string, Stripe.Price>): Promise<number> {
  if (price.currency === currency) return (price.unit_amount ?? 0) / 100
  let full = cache.get(price.id)
  if (!full) {
    full = await stripe.prices.retrieve(price.id, { expand: ['currency_options'] })
    cache.set(price.id, full)
  }
  return (full.currency_options?.[currency]?.unit_amount ?? 0) / 100
}

/** Lleva un importe de un periodo de Stripe a un mes. */
function toMonthly(amount: number, recurring: Stripe.Price.Recurring | null): number {
  if (!recurring) return 0
  const n = recurring.interval_count || 1
  if (recurring.interval === 'year') return amount / (12 * n)
  if (recurring.interval === 'week') return (amount * 52) / (12 * n)
  if (recurring.interval === 'day') return (amount * 365) / (12 * n)
  return amount / n
}

/** Aplica los descuentos vigentes de la suscripción (porcentaje o monto por factura). */
function applyDiscounts(monthly: number, sub: Stripe.Subscription, interval: Stripe.Price.Recurring | null): number {
  let out = monthly
  const now = Date.now() / 1000
  for (const d of sub.discounts ?? []) {
    if (typeof d === 'string') continue
    if (d.end && d.end < now) continue
    const coupon = (d as unknown as { coupon?: Stripe.Coupon; source?: { coupon?: Stripe.Coupon } }).coupon ??
      (d as unknown as { source?: { coupon?: Stripe.Coupon } }).source?.coupon
    if (!coupon) continue
    if (coupon.percent_off) out *= 1 - coupon.percent_off / 100
    else if (coupon.amount_off) out -= toMonthly(coupon.amount_off / 100, interval)
  }
  return Math.max(0, out)
}

export async function getStripeSnapshot(): Promise<StripeSnapshot> {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? ''
  const empty: StripeSnapshot = {
    mode: key.startsWith('sk_live_') ? 'live' : 'test',
    mrr: { usd: 0, mxn: 0 },
    paidThisMonth: { usd: 0, mxn: 0 },
    rows: [],
    monthlyByOrg: new Map(),
  }
  if (!key) return { ...empty, error: 'Stripe no está configurado.' }

  try {
    const stripe = getStripe()
    const service = createServiceClient()
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [subs, invoices, { data: appSubs }, { data: orgs }] = await Promise.all([
      stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.discounts'] }),
      stripe.invoices.list({ status: 'paid', created: { gte: Math.floor(monthStart.getTime() / 1000) }, limit: 100 }),
      service.from('subscriptions').select('organization_id, status, plan_id, currency, stripe_subscription_id'),
      service.from('organizations').select('id, name'),
    ])

    const names = new Map((orgs ?? []).map((o) => [o.id, o.name]))
    const bySubId = new Map((appSubs ?? []).filter((s) => s.stripe_subscription_id).map((s) => [s.stripe_subscription_id as string, s]))
    const priceCache = new Map<string, Stripe.Price>()
    const out: StripeSnapshot = { ...empty, mrr: { usd: 0, mxn: 0 }, paidThisMonth: { usd: 0, mxn: 0 }, rows: [], monthlyByOrg: new Map() }

    for (const sub of subs.data) {
      const app = bySubId.get(sub.id)
      const live = LIVE.has(sub.status)
      // Solo interesan las vivas o las que ChatVenti todavía referencia.
      if (!live && !app) continue

      const currency = sub.currency
      let monthly = 0
      let recurring: Stripe.Price.Recurring | null = null
      for (const item of sub.items.data) {
        recurring = item.price.recurring
        monthly += toMonthly((await itemAmount(stripe, item.price, currency, priceCache)) * (item.quantity ?? 1), item.price.recurring)
      }
      monthly = round2(applyDiscounts(monthly, sub, recurring))

      const { planId } = describeSubscriptionItems(
        sub.items.data.map((i) => ({ priceId: i.price.id, quantity: i.quantity ?? 0, lookupKey: i.price.lookup_key, interval: i.price.recurring?.interval }))
      )
      const orgId = app?.organization_id ?? (sub.metadata?.organization_id || null)
      const issues: string[] = []
      if (!app) {
        if (live) issues.push('Stripe la cobra y ningún negocio de ChatVenti la tiene registrada')
      } else {
        const appLive = app.status === 'active' || app.status === 'trialing' || app.status === 'past_due'
        if (appLive && !live) issues.push(`ChatVenti la da por vigente y en Stripe está «${sub.status}»`)
        else if (app.status !== sub.status) issues.push(`Estado distinto: ChatVenti «${app.status}», Stripe «${sub.status}»`)
        if (planId && app.plan_id && planId !== app.plan_id) issues.push(`Plan distinto: ChatVenti «${app.plan_id}», Stripe «${planId}»`)
        if (app.currency && app.currency !== currency) issues.push(`Moneda distinta: ChatVenti ${app.currency.toUpperCase()}, Stripe ${currency.toUpperCase()}`)
      }

      if (live && (currency === 'usd' || currency === 'mxn')) {
        out.mrr[currency] += monthly
        if (orgId) out.monthlyByOrg.set(orgId, { amount: monthly, currency })
      }
      out.rows.push({
        orgId,
        orgName: (orgId && names.get(orgId)) || 'Sin negocio',
        subscriptionId: sub.id,
        stripeStatus: sub.status,
        appStatus: app?.status ?? null,
        stripePlan: planId,
        appPlan: app?.plan_id ?? null,
        currency,
        monthly: live ? monthly : 0,
        issues,
      })
    }

    for (const inv of invoices.data) {
      if (inv.currency === 'usd' || inv.currency === 'mxn') out.paidThisMonth[inv.currency] += (inv.total_excluding_tax ?? inv.total) / 100
    }
    out.mrr = { usd: round2(out.mrr.usd), mxn: round2(out.mrr.mxn) }
    out.paidThisMonth = { usd: round2(out.paidThisMonth.usd), mxn: round2(out.paidThisMonth.mxn) }
    out.rows.sort((a, b) => b.issues.length - a.issues.length || b.monthly - a.monthly)
    return out
  } catch (e) {
    console.error('[conciliacion] no se pudo leer Stripe', e)
    return { ...empty, error: 'No se pudo leer Stripe en este momento.' }
  }
}
