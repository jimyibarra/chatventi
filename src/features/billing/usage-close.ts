import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getStripe, ivaTaxRateId } from '@/lib/stripe'
import { planById, usageOverage, type Currency, type PlanId } from './plans'

// =====================================================================
// Cierre mensual del consumo de IA.
//
//   El contador de cada mes lo lleva la base (disparador sobre `messages`).
//   Aquí, una vez al día, se cierran los meses YA TERMINADOS: se calcula el
//   excedente con la misma fórmula que ve el cliente en su panel y, si lo
//   hay, se carga en Stripe.
//
//   Dos tipos de negocio:
//     · Directo  → paga con su tarjeta. Solo se le carga el excedente (su
//                  plan ya lo cobra su suscripción de Stripe).
//     · De socio → no tiene Stripe propio. Al SOCIO externo se le factura el
//                  plan del mes (con su descuento) más el excedente, todo en
//                  una factura mensual que paga por enlace. Al socio INTERNO
//                  (otra plataforma de Grupo ELRI, como PASEN) no se le factura:
//                  es la misma empresa. Su mes se cierra igual, para que la
//                  otra plataforma lea el excedente y se lo cobre a su cliente.
//
//   🔴 Reclamo ANTES de cobrar ('open' → 'closing' en un solo UPDATE): dos
//   corridas a la vez no pueden cobrar el mismo mes. Si algo falla antes de
//   que Stripe acepte, el mes vuelve a 'open' y se reintenta al día siguiente.
// =====================================================================

type Service = SupabaseClient<Database>

// Stripe no admite cargos menores de 50 centavos.
const MIN_CHARGE_USD = 0.5
/** Mínimo para cargar un excedente en pesos (Stripe no cobra montos menores a $10 MXN). */
const MIN_CHARGE_MXN = 10
const LIVE = new Set(['active', 'trialing', 'past_due'])
const PARTNER_INVOICE_DAYS = 15

export type UsageCloseSummary = { closed: number; charged: number; failed: number; partnerInvoices: number }

type PartnerRow = {
  id: string
  name: string
  billing_email: string
  discount_pct: number
  stripe_customer_id: string | null
  kind: string
}

function monthLabel(periodStart: string): string {
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${periodStart}T00:00:00Z`)
  )
}

/** Primer día (UTC) del mes anterior al actual: el que toca cerrar. */
function previousMonthStart(currentMonth: string): string {
  const d = new Date(`${currentMonth}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Un negocio de socio que no tuvo ni una respuesta de IA no tiene fila de
 * consumo (la crea el disparador al primer mensaje), y sin fila no se le
 * facturaría el plan. Se abre aquí la del mes anterior para los que ya
 * existían antes de que empezara el mes en curso: el mes de alta no se cobra.
 */
async function openPartnerPeriods(service: Service, currentMonth: string): Promise<void> {
  const { data: orgs } = await service
    .from('organizations')
    .select('id')
    .not('partner_id', 'is', null)
    .lt('created_at', `${currentMonth}T00:00:00Z`)
    .limit(1000)
  if (!orgs?.length) return
  const period = previousMonthStart(currentMonth)
  await service.from('usage_periods').upsert(
    orgs.map((o) => ({ organization_id: o.id, period_start: period })),
    { onConflict: 'organization_id,period_start', ignoreDuplicates: true }
  )
}

async function partnerCustomer(service: Service, stripe: Stripe, partner: PartnerRow): Promise<string> {
  if (partner.stripe_customer_id) return partner.stripe_customer_id
  const customer = await stripe.customers.create(
    { name: partner.name, email: partner.billing_email, metadata: { partner_id: partner.id } },
    { idempotencyKey: `partner-customer-${partner.id}` }
  )
  await service.from('partners').update({ stripe_customer_id: customer.id }).eq('id', partner.id)
  partner.stripe_customer_id = customer.id
  return customer.id
}

export async function runUsageClose(service: Service): Promise<UsageCloseSummary> {
  const out: UsageCloseSummary = { closed: 0, charged: 0, failed: 0, partnerInvoices: 0 }
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`

  await openPartnerPeriods(service, currentMonth)

  const { data: periods, error } = await service
    .from('usage_periods')
    .select('organization_id, period_start, ai_replies')
    .eq('status', 'open')
    .lt('period_start', currentMonth)
    .limit(500)
  if (error) {
    console.error('[uso] no se pudieron leer los periodos', error.message)
    return out
  }

  const partners = new Map<string, PartnerRow | null>()
  // Socio + mes con cargos nuevos: al terminar se emite UNA factura por cada uno.
  const toInvoice = new Map<string, { customer: string; period: string }>()

  for (const period of periods ?? []) {
    const key = { organization_id: period.organization_id, period_start: period.period_start }
    const { data: claimed } = await service
      .from('usage_periods')
      .update({ status: 'closing' })
      .match(key)
      .eq('status', 'open')
      .select('organization_id')
    if (!claimed?.length) continue

    let itemId: string | null = null
    try {
      const [{ data: sub }, { data: org }] = await Promise.all([
        service
          .from('subscriptions')
          .select('plan_id, status, stripe_customer_id, billing_interval, currency')
          .eq('organization_id', period.organization_id)
          .maybeSingle(),
        service
          .from('organizations')
          .select('name, partner_id')
          .eq('id', period.organization_id)
          .maybeSingle(),
      ])

      const planId = (sub?.plan_id ?? null) as PlanId | null
      // Los socios pagan en dólares; un negocio directo, en la moneda de su suscripción.
      const currency: Currency = !org?.partner_id && sub?.currency === 'mxn' ? 'mxn' : 'usd'
      const usage = planId ? usageOverage(planId, period.ai_replies, currency) : null
      const idem = `usage-${period.organization_id}-${period.period_start}`
      const label = monthLabel(period.period_start)
      let chargeUsd = 0
      let customer: string | null = null

      if (org?.partner_id && planId && usage && sub && LIVE.has(sub.status) && stripeReady) {
        // ---- Negocio de socio: plan del mes + excedente, a la cuenta del socio.
        if (!partners.has(org.partner_id)) {
          const { data: p } = await service
            .from('partners')
            .select('id, name, billing_email, discount_pct, stripe_customer_id, kind')
            .eq('id', org.partner_id)
            .maybeSingle()
          partners.set(org.partner_id, p ? { ...p, discount_pct: Number(p.discount_pct) } : null)
        }
        const partner = partners.get(org.partner_id)
        if (partner && partner.kind !== 'internal') {
          const planFee = Number((planById(planId).priceUsd * (1 - partner.discount_pct / 100)).toFixed(2))
          chargeUsd = Number((planFee + usage.charge).toFixed(2))
          if (chargeUsd > 0) {
            const stripe = getStripe()
            customer = await partnerCustomer(service, stripe, partner)
            const item = await stripe.invoiceItems.create(
              {
                customer,
                amount: Math.round(chargeUsd * 100),
                currency: 'usd',
                description: `${org.name} · ChatVenti ${planById(planId).name} · ${label} (plan $${planFee.toFixed(
                  2
                )}${usage.extra > 0 ? ` + ${usage.extra.toLocaleString('en-US')} respuestas de IA adicionales $${usage.charge.toFixed(2)}` : ''})`,
                metadata: { organization_id: period.organization_id, period_start: period.period_start },
              },
              { idempotencyKey: idem }
            )
            itemId = item.id
            toInvoice.set(`${partner.id}|${period.period_start}`, { customer, period: period.period_start })
          }
        }
      } else if (
        planId &&
        usage &&
        sub?.stripe_customer_id &&
        LIVE.has(sub.status) &&
        usage.charge >= (currency === 'mxn' ? MIN_CHARGE_MXN : MIN_CHARGE_USD) &&
        stripeReady
      ) {
        // ---- Negocio directo: solo el excedente, a su propia tarjeta.
        const stripe = getStripe()
        customer = sub.stripe_customer_id
        chargeUsd = usage.charge
        const item = await stripe.invoiceItems.create(
          {
            customer,
            amount: Math.round(chargeUsd * 100),
            currency,
            // En pesos se suma el IVA, igual que en la suscripción.
            tax_rates: currency === 'mxn' ? [await ivaTaxRateId()] : undefined,
            description: `Uso de IA por encima de lo incluido en el plan ${planById(planId).name} · ${label} · ${usage.extra.toLocaleString(
              'en-US'
            )} respuestas adicionales`,
          },
          { idempotencyKey: idem }
        )
        itemId = item.id
        // En el plan mensual el cargo viaja en la siguiente factura. En el
        // anual esa factura puede tardar meses: se emite una ahora.
        if (sub.billing_interval === 'year') {
          await stripe.invoices.create(
            { customer, auto_advance: true, pending_invoice_items_behavior: 'include' },
            { idempotencyKey: `${idem}-inv` }
          )
        }
      }

      await service
        .from('usage_periods')
        .update({
          status: itemId ? 'charged' : 'closed',
          plan_id: planId,
          included_replies: usage?.included ?? null,
          extra_replies: usage?.extra ?? null,
          charge_usd: itemId ? chargeUsd : 0,
          charge_currency: currency,
          billed_customer: itemId ? customer : null,
          stripe_invoice_item_id: itemId,
          closed_at: new Date().toISOString(),
        })
        .match(key)
      if (itemId) out.charged++
      else out.closed++
    } catch (err) {
      console.error('[uso] error cerrando', period.organization_id, period.period_start, err)
      // Si Stripe YA aceptó el cargo, el mes se queda en 'closing' a propósito:
      // reabrirlo podría cobrarlo otra vez cuando caduque la clave de
      // idempotencia (24 h). Un 'closing' viejo es una alerta para revisar.
      if (!itemId) await service.from('usage_periods').update({ status: 'open' }).match(key)
      out.failed++
    }
  }

  // Una factura por socio y mes, con todos sus negocios dentro.
  for (const [id, { customer }] of toInvoice) {
    try {
      await getStripe().invoices.create(
        {
          customer,
          collection_method: 'send_invoice',
          days_until_due: PARTNER_INVOICE_DAYS,
          auto_advance: true,
          pending_invoice_items_behavior: 'include',
        },
        { idempotencyKey: `partner-invoice-${id}` }
      )
      out.partnerInvoices++
    } catch (err) {
      // Los cargos ya están anotados en la cuenta del socio: entrarán en la
      // siguiente factura que se emita. No se pierde dinero, solo se retrasa.
      console.error('[uso] no se pudo emitir la factura del socio', id, err)
    }
  }
  return out
}
