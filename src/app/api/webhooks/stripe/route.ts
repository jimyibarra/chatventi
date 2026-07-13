import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, STRIPE_WEBHOOK_SECRET, PRICE_TEAM, describeSubscriptionItems } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Webhook de Stripe = fuente de verdad del estado de la suscripción.
 * NUNCA se concede acceso desde el frontend. Verifica la firma, y sincroniza
 * la fila de `subscriptions` con service_role (subscriptions no tiene política
 * de escritura por RLS → nadie más puede tocarla). Idempotente: cada evento
 * reescribe el estado completo derivado de los items de Stripe.
 */
export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe] falta STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe] firma inválida', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      default:
        // Otros eventos (invoice.*, checkout.session.completed) no son
        // necesarios: subscription.* ya trae el estado completo.
        break
    }
  } catch (e) {
    console.error(`[stripe] error procesando ${event.type}`, e)
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

interface SubShape {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end?: number
  trial_end?: number | null
  metadata?: Record<string, string>
  items: { data: Array<{ price: { id: string }; quantity?: number; current_period_end?: number }> }
}

function unixToIso(sec?: number | null): string | null {
  return sec ? new Date(sec * 1000).toISOString() : null
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const sub = subscription as unknown as SubShape
  const admin = createServiceClient()

  // Resolver la organización: metadata primero; si no, por el customer id.
  let orgId = sub.metadata?.organization_id
  if (!orgId) {
    const { data: row } = await admin
      .from('subscriptions')
      .select('organization_id')
      .eq('stripe_customer_id', sub.customer)
      .maybeSingle()
    orgId = (row?.organization_id as string | undefined) ?? undefined
  }
  if (!orgId) {
    console.error('[stripe] subscription sin organization_id resoluble', sub.id)
    return
  }

  const priceIds = sub.items.data.map((i) => i.price.id)
  const { aiTier, hasDomain } = describeSubscriptionItems(priceIds)
  const teamSeats = PRICE_TEAM
    ? sub.items.data.filter((i) => i.price.id === PRICE_TEAM).reduce((n, i) => n + (i.quantity ?? 0), 0)
    : 0

  // El status 'deleted' de Stripe llega como canceled; normalizamos.
  const status = sub.status === 'canceled' ? 'canceled' : sub.status
  const periodEnd = sub.current_period_end ?? sub.items.data[0]?.current_period_end

  // Higiene anti-duplicado: si ya seguimos OTRA suscripción para esta org y
  // este evento es de una suscripción distinta que NO está viva, lo ignoramos.
  // Evita que la cancelación de una suscripción duplicada pise a la activa
  // (la fila se indexa por organization_id, así que el último evento ganaría).
  const incomingLive = status === 'active' || status === 'trialing'
  const { data: existingRow } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('organization_id', orgId)
    .maybeSingle()
  const trackedId = existingRow?.stripe_subscription_id as string | null | undefined
  if (trackedId && trackedId !== sub.id && !incomingLive) {
    console.log(`[stripe] ignora evento de sub duplicada ${sub.id} (org sigue ${trackedId})`)
    return
  }

  const { error } = await admin.from('subscriptions').upsert(
    {
      organization_id: orgId,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      status,
      ai_tier: aiTier,
      has_domain: hasDomain,
      team_seats: teamSeats,
      current_period_end: unixToIso(periodEnd),
      trial_end: unixToIso(sub.trial_end),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )
  if (error) {
    console.error('[stripe] error upsert subscription', error)
    throw new Error('upsert failed')
  }
  console.log(`[stripe] sync org=${orgId} status=${status} ai=${aiTier}`)
}
