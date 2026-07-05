// =====================================================================
// ChatVenti · Fase 7 · Setup de productos/precios en Stripe (idempotente)
//   Uso:  STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-setup.mjs
//   Crea (o reutiliza por lookup_key) los precios y imprime las líneas
//   STRIPE_PRICE_* para pegar en .env.local y en Vercel.
// =====================================================================
import Stripe from 'stripe'

const key = (process.env.STRIPE_SECRET_KEY || '').trim()
if (!key) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno.')
  process.exit(1)
}
if (key.startsWith('sk_live_')) {
  console.error('⚠️  Estás usando una clave LIVE. Para setup de pruebas usa sk_test_. Abortando.')
  process.exit(1)
}
const stripe = new Stripe(key)

// Catálogo: producto + precio mensual (USD) + lookup_key + env var destino.
const CATALOG = [
  { env: 'STRIPE_PRICE_STARTER', product: 'ChatVenti Starter', lookup: 'cv_starter', usd: 29 },
  { env: 'STRIPE_PRICE_AI_300', product: 'Recepcionista IA · 300 conv', lookup: 'cv_ai_300', usd: 19 },
  { env: 'STRIPE_PRICE_AI_1000', product: 'Recepcionista IA · 1.000 conv', lookup: 'cv_ai_1000', usd: 39 },
  { env: 'STRIPE_PRICE_AI_3000', product: 'Recepcionista IA · 3.000 conv', lookup: 'cv_ai_3000', usd: 109 },
  { env: 'STRIPE_PRICE_DOMAIN', product: 'Dominio propio', lookup: 'cv_domain', usd: 5 },
  { env: 'STRIPE_PRICE_TEAM', product: 'Cuenta de empleado extra', lookup: 'cv_team', usd: 19 },
]

async function ensurePrice(item) {
  // ¿Ya existe un precio con este lookup_key? -> reutiliza.
  const existing = await stripe.prices.list({ lookup_keys: [item.lookup], limit: 1 })
  if (existing.data.length > 0) {
    return { id: existing.data[0].id, reused: true }
  }
  // Crea el producto y el precio recurrente mensual con lookup_key.
  const product = await stripe.products.create({ name: item.product })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: item.usd * 100,
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: item.lookup,
  })
  return { id: price.id, reused: false }
}

const lines = []
for (const item of CATALOG) {
  const { id, reused } = await ensurePrice(item)
  console.log(`${reused ? '· reusado' : '✓ creado '}  ${item.product.padEnd(32)} $${item.usd}/mes  ${id}`)
  lines.push(`${item.env}=${id}`)
}

console.log('\n--- Pega estas líneas en .env.local y en Vercel (Production) ---\n')
console.log(lines.join('\n'))
console.log('')
