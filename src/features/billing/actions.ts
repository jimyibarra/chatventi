'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { annualLookupKey, annualPriceIds, getStripe, ivaTaxRateId, planPriceId, PRICE_SEAT } from '@/lib/stripe'
import { billingCurrency } from './currency'
import { planById, seatLimit } from './plans'

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

const checkoutSchema = z.object({
  plan: z.enum(['arranque', 'negocio', 'profesional', 'multisede']),
  interval: z.enum(['month', 'year']).optional(),
  extraSeats: z.coerce.number().int().min(0).max(50).optional(),
})

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Crea (o reutiliza) el customer de Stripe de la org y abre un Checkout de
 * suscripción con: el plan elegido + add-ons. La prueba gratis (14 días, sin
 * tarjeta) ocurre a nivel de app ANTES de llegar aquí.
 * El acceso NO se concede aquí — lo concede el webhook al confirmar Stripe.
 */
export async function createCheckoutSession(raw: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { plan, interval = 'month', extraSeats = 0 } = parsed.data
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: 'Stripe no está configurado todavía (faltan claves o price IDs).' }
  }
  const stripe = getStripe()

  // Mensual: price ids de entorno. Anual: por lookup_key en Stripe. Una
  // suscripción no puede mezclar periodicidades, así que el acceso extra
  // también tiene su precio anual.
  let planPrice = planPriceId(plan)
  let seatPrice = PRICE_SEAT
  if (interval === 'year') {
    try {
      const annual = await annualPriceIds()
      planPrice = annual[annualLookupKey(plan)] ?? ''
      seatPrice = annual[annualLookupKey('seat')] ?? ''
    } catch (e) {
      console.error('[billing] precios anuales', e)
      planPrice = ''
    }
  }
  if (!planPrice) {
    return { ok: false, error: 'Stripe no está configurado todavía (faltan claves o price IDs).' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'owner' && role !== 'super_admin') {
    return { ok: false, error: 'Solo el dueño puede gestionar la suscripción.' }
  }

  // Customer: reutiliza el de la org o crea uno nuevo (persistido con
  // service_role porque subscriptions no tiene política de escritura por RLS).
  const admin = createServiceClient()
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  let customerId = existing?.stripe_customer_id as string | undefined
  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { organization_id: orgId as string },
        // Recibos, facturas y portal de Stripe en español (si no, salen en inglés).
        preferred_locales: ['es-419'],
      })
      customerId = customer.id
      await admin.from('subscriptions').upsert(
        { organization_id: orgId, stripe_customer_id: customerId },
        { onConflict: 'organization_id' }
      )
    }

    // Anti-DUPLICADO: si el customer ya tiene una suscripción viva en Stripe
    // (la fuente de verdad), NO abrimos otro checkout. Cierra la carrera en la
    // que el webhook aún no sincronizó tras un primer pago y la UI todavía
    // muestra el botón de compra → evita cobrar dos veces por el mismo periodo.
    const liveStates = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']
    const currentSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    if (currentSubs.data.some((s) => liveStates.includes(s.status))) {
      return {
        ok: false,
        error: 'Ya tienes una suscripción activa. Adminístrala desde “Administrar suscripción”.',
      }
    }

    // Moneda: la del cliente en Stripe si ya pagó antes (no se puede cambiar);
    // si no, la del país del negocio. En pesos se suma el IVA (16 %).
    const [{ data: org }, customer] = await Promise.all([
      admin.from('organizations').select('country').eq('id', orgId).maybeSingle(),
      stripe.customers.retrieve(customerId),
    ])
    const customerCurrency = 'deleted' in customer ? null : customer.currency
    const currency = await billingCurrency({ country: org?.country, subscriptionCurrency: customerCurrency })
    const taxRates = currency === 'mxn' ? [await ivaTaxRateId()] : undefined

    // Líneas del checkout: el plan + accesos extra. "Tu App" y el dominio
    // propio no se cobran: todavía no existen.
    const lineItems: { price: string; quantity: number; tax_rates?: string[] }[] = [
      { price: planPrice, quantity: 1, tax_rates: taxRates },
    ]
    if (extraSeats > 0 && seatPrice) lineItems.push({ price: seatPrice, quantity: extraSeats, tax_rates: taxRates })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      currency,
      line_items: lineItems,
      // El código de promoción (/admin/promocion) se aplica aquí. Ya NO hay trial de
      // Stripe: la prueba gratis (sin tarjeta) ocurre a nivel de app antes.
      // En el plan anual NO: ya lleva dos meses de regalo, y ese cupón sobre
      // una factura de un año entero descontaría el 30 % de los doce meses.
      allow_promotion_codes: interval !== 'year',
      subscription_data: {
        metadata: { organization_id: orgId as string },
      },
      metadata: { organization_id: orgId as string },
      success_url: `${baseUrl()}/dashboard/facturacion?success=1`,
      cancel_url: `${baseUrl()}/dashboard/facturacion?canceled=1`,
    })

    if (!session.url) return { ok: false, error: 'Stripe no devolvió URL de checkout.' }
    return { ok: true, url: session.url }
  } catch (e) {
    console.error('[billing] checkout error', e)
    return { ok: false, error: 'No se pudo iniciar el checkout.' }
  }
}

const PLAN_IDS = ['arranque', 'negocio', 'profesional', 'multisede'] as const
const changeSchema = z.object({ plan: z.enum(PLAN_IDS), interval: z.enum(['month', 'year']) })

export type ChangePlanResult = { ok: true } | { ok: false; error: string }

/**
 * Cambia el plan (y la periodicidad) de una suscripción de Stripe desde
 * Facturación. Se hace aquí y no en el portal de Stripe porque las
 * suscripciones llevan varios renglones (plan + accesos extra) y el cobro va
 * en la moneda del negocio con su IVA.
 *   · Se cobra HOY la diferencia proporcional; si baja de plan, el saldo a
 *     favor se descuenta de las siguientes facturas (proration de Stripe).
 *   · Si la tarjeta rechaza ese cobro, NO se cambia nada (error_if_incomplete).
 */
export async function changePlan(raw: unknown): Promise<ChangePlanResult> {
  const parsed = changeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Elige un plan válido.' }
  const { plan, interval } = parsed.data
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return { ok: false, error: 'Stripe no está configurado todavía.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'owner' && role !== 'super_admin') return { ok: false, error: 'Solo el dueño puede cambiar el plan.' }

  const admin = createServiceClient()
  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status, plan_id, billing_interval, team_seats, currency')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!row?.stripe_subscription_id) return { ok: false, error: 'Tu plan no se paga con tarjeta aquí: no se puede cambiar desde esta pantalla.' }
  if (row.status !== 'active' && row.status !== 'trialing') {
    return { ok: false, error: 'Primero paga la factura pendiente; después podrás cambiar de plan.' }
  }
  if (row.plan_id === plan && (row.billing_interval ?? 'month') === interval) {
    return { ok: false, error: 'Ya tienes ese plan.' }
  }

  // No se baja a un plan con menos accesos de los que ya usa el equipo.
  const limit = seatLimit(plan, row.team_seats ?? 0)
  if (limit !== null) {
    const { data: used } = await supabase.rpc('org_seats_used', { p_org: orgId })
    if ((used ?? 0) > limit) {
      return {
        ok: false,
        error: `Tu equipo usa ${used} accesos y el plan ${planById(plan).name} permite ${limit}. Quita accesos en Equipo antes de cambiar.`,
      }
    }
  }

  const stripe = getStripe()
  try {
    const annual = await annualPriceIds()
    const monthlyPlan = new Set(PLAN_IDS.map((p) => planPriceId(p)).filter(Boolean))
    const annualPlan = new Set(PLAN_IDS.map((p) => annual[annualLookupKey(p)]).filter(Boolean))
    const seatPrices = new Set([PRICE_SEAT, annual[annualLookupKey('seat')]].filter(Boolean))
    const newPlanPrice = interval === 'year' ? annual[annualLookupKey(plan)] : planPriceId(plan)
    const newSeatPrice = interval === 'year' ? annual[annualLookupKey('seat')] : PRICE_SEAT
    if (!newPlanPrice) return { ok: false, error: 'Stripe no está configurado todavía (faltan precios).' }

    const current = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    const planItem = current.items.data.find((i) => monthlyPlan.has(i.price.id) || annualPlan.has(i.price.id))
    const seatItem = current.items.data.find((i) => seatPrices.has(i.price.id))
    const others = current.items.data.filter((i) => i !== planItem && i !== seatItem)
    // Catálogo anterior (Starter + IA) o renglones que no sabemos mover: a mano.
    if (!planItem || others.length > 0) {
      return { ok: false, error: 'Tu suscripción es del catálogo anterior. Escríbenos a soporte@chatventi.com y te cambiamos de plan.' }
    }

    // En pesos cada renglón lleva el IVA, igual que al contratar.
    const taxRates = current.currency === 'mxn' ? [await ivaTaxRateId()] : undefined
    const items: { id: string; price: string; tax_rates?: string[] }[] = [
      { id: planItem.id, price: newPlanPrice, tax_rates: taxRates },
    ]
    // Todos los renglones comparten periodicidad: si cambia, cambia también el de accesos.
    if (seatItem && newSeatPrice && seatItem.price.id !== newSeatPrice) {
      items.push({ id: seatItem.id, price: newSeatPrice, tax_rates: taxRates })
    }

    await stripe.subscriptions.update(row.stripe_subscription_id, {
      items,
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
    })
  } catch (e) {
    const code = (e as { code?: string; type?: string }).type
    console.error('[billing] cambio de plan', e)
    return {
      ok: false,
      error:
        code === 'StripeCardError'
          ? 'Tu tarjeta rechazó el cobro del cambio. No se cambió nada: revisa tu tarjeta en «Administrar suscripción».'
          : 'No se pudo cambiar el plan. Inténtalo de nuevo en un momento.',
    }
  }

  // El webhook también lo sincroniza; se escribe ya para que la pantalla lo muestre al instante.
  await admin.from('subscriptions').update({ plan_id: plan, billing_interval: interval }).eq('organization_id', orgId)
  return { ok: true }
}

/** Abre el portal de facturación de Stripe (gestionar/cancelar/tarjeta). */
export async function createPortalSession(): Promise<CheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: 'Stripe no está configurado todavía.' }
  }
  const stripe = getStripe()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  const admin = createServiceClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  const customerId = sub?.stripe_customer_id as string | undefined
  if (!customerId) return { ok: false, error: 'Aún no tienes una suscripción.' }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl()}/dashboard/facturacion`,
    })
    return { ok: true, url: portal.url }
  } catch (e) {
    console.error('[billing] portal error', e)
    return { ok: false, error: 'No se pudo abrir el portal.' }
  }
}
