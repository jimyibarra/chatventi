import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { planPrice, withIva, type Currency, type PlanId } from './plans'

// =====================================================================
// "Recomienda y gana un mes".
//
//   Quien recomienda recibe un mes de SU plan como saldo a favor en Stripe
//   (se descuenta solo de su siguiente factura), cuando el negocio que
//   recomendó hace su primer pago real. Mismo molde que PASEN: saldo a favor
//   con clave de idempotencia, una sola recompensa por negocio recomendado.
//
//   Dos momentos:
//     1. registerReferralPayment — llega un pago del recomendado: se anota la
//        recompensa (única por `referred_org`).
//     2. settlePendingRewards    — se abona en cuanto quien recomendó tiene un
//        cliente de Stripe con plan vigente. Si aún está en prueba, espera.
// =====================================================================

type Admin = SupabaseClient<Database>

const LIVE = new Set(['active', 'trialing'])

export async function registerReferralPayment(
  admin: Admin,
  stripe: Stripe,
  customerId: string,
  amountPaid: number
): Promise<void> {
  // Una factura de $0 (cupón del 100 %, prorrateo a cero) no es un pago.
  if (amountPaid <= 0) return

  const { data: sub } = await admin
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  // Stripe no garantiza el orden de los eventos: `invoice.paid` puede llegar
  // antes de que `subscription.created` haya escrito la fila. El cliente de
  // Stripe lleva la organización en sus metadatos desde que se crea.
  let orgId: string | undefined = sub?.organization_id ?? undefined
  if (!orgId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted) orgId = customer.metadata?.organization_id
  }
  if (!orgId) return

  const { data: org } = await admin
    .from('organizations')
    .select('referred_by')
    .eq('id', orgId)
    .maybeSingle()
  if (!org?.referred_by) return

  // `referred_org` es único: la segunda factura del mismo negocio no crea nada.
  const { error } = await admin
    .from('referral_rewards')
    .upsert(
      { referrer_org: org.referred_by, referred_org: orgId },
      { onConflict: 'referred_org', ignoreDuplicates: true }
    )
  if (error) {
    console.error('[referidos] no se pudo anotar la recompensa', error.message)
    return
  }
  await settlePendingRewards(admin, stripe, org.referred_by)
}

/** Abona las recompensas que `referrerOrg` tenga esperando. Idempotente. */
export async function settlePendingRewards(
  admin: Admin,
  stripe: Stripe,
  referrerOrg: string
): Promise<number> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, status, plan_id, currency')
    .eq('organization_id', referrerOrg)
    .maybeSingle()
  if (!sub?.stripe_customer_id || !sub.plan_id || !LIVE.has(sub.status)) return 0

  // Reclamo atómico: quien cambia 'pending' → 'crediting' es el único que abona.
  const { data: claimed } = await admin
    .from('referral_rewards')
    .update({ status: 'crediting' })
    .eq('referrer_org', referrerOrg)
    .eq('status', 'pending')
    .select('id')

  // Un mes de su plan, en la moneda en que paga. En pesos, con el IVA incluido:
  // el saldo a favor se descuenta del total de la factura, que ya lleva IVA.
  const currency: Currency = sub.currency === 'mxn' ? 'mxn' : 'usd'
  const monthly = planPrice(sub.plan_id as PlanId, currency)
  const amountCents = Math.round((currency === 'mxn' ? withIva(monthly) : monthly) * 100)
  let credited = 0
  for (const reward of claimed ?? []) {
    try {
      const txn = await stripe.customers.createBalanceTransaction(
        sub.stripe_customer_id,
        {
          amount: -amountCents, // negativo = saldo a favor del cliente
          currency,
          description: 'Recomienda y gana: un mes de regalo por tu recomendación',
        },
        { idempotencyKey: `referral-${reward.id}` }
      )
      await admin
        .from('referral_rewards')
        .update({
          status: 'credited',
          amount_cents: amountCents,
          stripe_txn_id: txn.id,
          credited_at: new Date().toISOString(),
        })
        .eq('id', reward.id)
      credited++
    } catch (err) {
      console.error('[referidos] no se pudo abonar', reward.id, err)
      // Vuelve a 'pending': el siguiente evento lo reintenta, y la clave de
      // idempotencia impide abonar dos veces si Stripe sí lo había aplicado.
      await admin.from('referral_rewards').update({ status: 'pending' }).eq('id', reward.id)
    }
  }
  return credited
}
