import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getStripe } from '@/lib/stripe'
import { planById, usageOverage, type PlanId } from './plans'

// =====================================================================
// Cierre mensual del consumo de IA.
//
//   El contador de cada mes lo lleva la base (disparador sobre `messages`).
//   Aquí, una vez al día, se cierran los meses YA TERMINADOS: se calcula el
//   excedente con la misma fórmula que ve el cliente en su panel y, si lo
//   hay, se carga en Stripe.
//
//   🔴 Reclamo ANTES de cobrar ('open' → 'closing' en un solo UPDATE): dos
//   corridas a la vez no pueden cobrar el mismo mes. Si algo falla después de
//   reclamar, el mes vuelve a 'open' y se reintenta al día siguiente; la
//   clave de idempotencia de Stripe evita el doble cargo en ese reintento.
// =====================================================================

type Service = SupabaseClient<Database>

// Stripe no admite cargos menores de 50 centavos.
const MIN_CHARGE_USD = 0.5
const LIVE = new Set(['active', 'trialing', 'past_due'])

export type UsageCloseSummary = { closed: number; charged: number; failed: number }

function monthLabel(periodStart: string): string {
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${periodStart}T00:00:00Z`)
  )
}

export async function runUsageClose(service: Service): Promise<UsageCloseSummary> {
  const out: UsageCloseSummary = { closed: 0, charged: 0, failed: 0 }
  const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`

  const { data: periods, error } = await service
    .from('usage_periods')
    .select('organization_id, period_start, ai_replies')
    .eq('status', 'open')
    .lt('period_start', currentMonth)
    .limit(200)
  if (error) {
    console.error('[uso] no se pudieron leer los periodos', error.message)
    return out
  }

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
      const { data: sub } = await service
        .from('subscriptions')
        .select('plan_id, status, stripe_customer_id, billing_interval')
        .eq('organization_id', period.organization_id)
        .maybeSingle()

      const planId = (sub?.plan_id ?? null) as PlanId | null
      const usage = planId ? usageOverage(planId, period.ai_replies) : null
      const billable =
        !!usage &&
        !!sub?.stripe_customer_id &&
        LIVE.has(sub.status) &&
        usage.chargeUsd >= MIN_CHARGE_USD &&
        !!process.env.STRIPE_SECRET_KEY?.trim()

      if (billable && usage && sub?.stripe_customer_id && planId) {
        const stripe = getStripe()
        const idem = `usage-${period.organization_id}-${period.period_start}`
        const item = await stripe.invoiceItems.create(
          {
            customer: sub.stripe_customer_id,
            amount: Math.round(usage.chargeUsd * 100),
            currency: 'usd',
            description: `Uso de IA por encima de lo incluido en el plan ${planById(planId).name} · ${monthLabel(
              period.period_start
            )} · ${usage.extra.toLocaleString('en-US')} respuestas adicionales`,
          },
          { idempotencyKey: idem }
        )
        itemId = item.id
        // En el plan mensual el cargo viaja en la siguiente factura. En el
        // anual esa factura puede tardar meses: se emite una ahora.
        if (sub.billing_interval === 'year') {
          await stripe.invoices.create(
            { customer: sub.stripe_customer_id, auto_advance: true, pending_invoice_items_behavior: 'include' },
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
          charge_usd: itemId ? (usage?.chargeUsd ?? 0) : 0,
          billed_customer: itemId ? (sub?.stripe_customer_id ?? null) : null,
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
  return out
}
