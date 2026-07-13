// =====================================================================
// ChatVenti · Limpieza de suscripciones DUPLICADAS en Stripe
//   Uso: node --env-file=.env.local scripts/stripe-dedupe-subscriptions.mjs
//
//   Por cada customer con más de una suscripción viva (trialing/active/
//   past_due/unpaid): conserva la MÁS RECIENTE y cancela las demás. Luego
//   re-sincroniza la fila de subscriptions con la que se conserva. El guard
//   del webhook evita que las cancelaciones pisen a la activa.
//   Solo debería encontrar duplicados en TEST; en prod normalmente no hay.
// =====================================================================
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const key = (process.env.STRIPE_SECRET_KEY || '').trim()
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const svc = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!key || !url || !svc) {
  console.error('Faltan STRIPE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const stripe = new Stripe(key)
const admin = createClient(url, svc, { auth: { persistSession: false } })

const P = {
  ai300: process.env.STRIPE_PRICE_AI_300,
  ai1000: process.env.STRIPE_PRICE_AI_1000,
  ai3000: process.env.STRIPE_PRICE_AI_3000,
  domain: process.env.STRIPE_PRICE_DOMAIN,
  team: process.env.STRIPE_PRICE_TEAM,
}
const LIVE = new Set(['trialing', 'active', 'past_due', 'unpaid'])

function describe(sub) {
  let aiTier = 'none'
  let hasDomain = false
  let teamSeats = 0
  for (const it of sub.items.data) {
    const pid = it.price.id
    if (pid === P.ai300) aiTier = '300'
    else if (pid === P.ai1000) aiTier = '1000'
    else if (pid === P.ai3000) aiTier = '3000'
    else if (pid === P.domain) hasDomain = true
    else if (pid === P.team) teamSeats += it.quantity ?? 0
  }
  return { aiTier, hasDomain, teamSeats }
}
const iso = (s) => (s ? new Date(s * 1000).toISOString() : null)

async function resolveOrg(sub) {
  if (sub.metadata?.organization_id) return sub.metadata.organization_id
  const { data } = await admin
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', sub.customer)
    .maybeSingle()
  return data?.organization_id ?? null
}

async function main() {
  const all = await stripe.subscriptions.list({ status: 'all', limit: 100 })
  const byCustomer = new Map()
  for (const s of all.data) {
    if (!LIVE.has(s.status)) continue
    const arr = byCustomer.get(s.customer) ?? []
    arr.push(s)
    byCustomer.set(s.customer, arr)
  }

  let dupes = 0
  for (const [customer, subs] of byCustomer) {
    if (subs.length < 2) continue
    dupes++
    subs.sort((a, b) => b.created - a.created)
    const keep = subs[0]
    const cancel = subs.slice(1)
    console.log(`\nCustomer ${customer}: ${subs.length} suscripciones vivas.`)
    console.log(`  Conservar: ${keep.id} (${keep.status}, creada ${new Date(keep.created * 1000).toISOString()})`)

    // 1) Re-sincronizar la BD con la que se conserva (antes de cancelar).
    const orgId = await resolveOrg(keep)
    if (orgId) {
      const { aiTier, hasDomain, teamSeats } = describe(keep)
      const periodEnd = keep.current_period_end ?? keep.items.data[0]?.current_period_end
      await admin.from('subscriptions').upsert(
        {
          organization_id: orgId,
          stripe_customer_id: keep.customer,
          stripe_subscription_id: keep.id,
          status: keep.status,
          ai_tier: aiTier,
          has_domain: hasDomain,
          team_seats: teamSeats,
          current_period_end: iso(periodEnd),
          trial_end: iso(keep.trial_end),
          cancel_at_period_end: keep.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      )
      console.log(`  BD re-sincronizada (org ${orgId}, status ${keep.status}, ai ${aiTier}).`)
    } else {
      console.log('  ⚠️  No se pudo resolver la organización de la suscripción conservada.')
    }

    // 2) Cancelar las duplicadas.
    for (const c of cancel) {
      await stripe.subscriptions.cancel(c.id)
      console.log(`  ✗ Cancelada duplicada ${c.id} (${c.status}).`)
    }
  }

  if (dupes === 0) console.log('No se encontraron suscripciones duplicadas. Nada que hacer.')
  else console.log(`\n✅ Listo. Customers con duplicados corregidos: ${dupes}.`)
}

main().catch((e) => {
  console.error('❌ Error:', e.message || e)
  process.exit(1)
})
