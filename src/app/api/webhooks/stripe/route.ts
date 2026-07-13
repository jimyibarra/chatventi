import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, STRIPE_WEBHOOK_SECRET, PRICE_TEAM, describeSubscriptionItems } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { aiTierById, monthlyTotalUsd, type AiTierId } from '@/features/billing/plans'
import { sendEmail, emailsEnabled } from '@/features/emails/mailer'
import { subscriptionActiveEmail } from '@/features/emails/templates'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

// Resumen legible del plan para el correo de suscripción activa.
function planLine(aiTier: AiTierId, hasDomain: boolean, teamSeats: number): string {
  const tier = aiTierById(aiTier)
  const parts = ['ChatVenti Starter']
  if (tier.id !== 'none') parts.push(`Recepcionista IA (${tier.detail})`)
  if (hasDomain) parts.push('Dominio propio')
  if (teamSeats > 0) parts.push(`${teamSeats} cuenta(s) de empleado extra`)
  return parts.join(' · ')
}

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
    .select('stripe_subscription_id, subscription_email_sent_at')
    .eq('organization_id', orgId)
    .maybeSingle()
  const trackedId = existingRow?.stripe_subscription_id as string | null | undefined
  if (trackedId && trackedId !== sub.id && !incomingLive) {
    console.log(`[stripe] ignora evento de sub duplicada ${sub.id} (org sigue ${trackedId})`)
    return
  }
  const alreadyEmailed = Boolean(existingRow?.subscription_email_sent_at)

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

  // Correo de "suscripción activa" (una vez, al activarse el plan). Marcamos el
  // flag de inmediato para evitar doble envío entre eventos created/updated y
  // enviamos con after() para no retrasar la respuesta a Stripe.
  if (incomingLive && !alreadyEmailed && emailsEnabled()) {
    await admin
      .from('subscriptions')
      .update({ subscription_email_sent_at: new Date().toISOString() })
      .eq('organization_id', orgId)

    const trialEndIso = unixToIso(sub.trial_end)
    after(async () => {
      const { data: org } = await admin
        .from('organizations')
        .select('name, contact_email')
        .eq('id', orgId)
        .maybeSingle()
      if (!org?.contact_email) return
      const trialEndLabel = trialEndIso
        ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
            new Date(trialEndIso)
          )
        : null
      const { subject, html } = subscriptionActiveEmail({
        orgName: org.name,
        planLine: planLine(aiTier, hasDomain, teamSeats),
        totalUsd: monthlyTotalUsd({ aiTier, domain: hasDomain, teamSeats }),
        trialEndLabel,
        siteUrl: SITE,
      })
      await sendEmail({ to: org.contact_email, subject, html })
    })
  }
}
