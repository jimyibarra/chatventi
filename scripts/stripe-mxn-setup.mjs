// =====================================================================
// ChatVenti · Precios en pesos mexicanos + IVA en Stripe (idempotente).
//   Uso: node --env-file=.env.local scripts/stripe-mxn-setup.mjs
//   1. Agrega a cada precio que ya existe su importe fijo en pesos
//      (currency_options.mxn): mensual con STRIPE_PRICE_*, anual por lookup_key.
//   2. Crea la tasa de IVA 16 % de México «más IVA» (metadata chatventi=iva_mx),
//      que es la que busca ivaTaxRateId() en src/lib/stripe.ts.
//   Los importes deben coincidir con priceMxn / ADDON_SEAT_MXN de plans.ts.
//   Correrlo otra vez al pasar Stripe a modo real (con la llave live).
// =====================================================================
import Stripe from 'stripe'

const key = (process.env.STRIPE_SECRET_KEY || '').trim()
if (!key) {
  console.error('Falta STRIPE_SECRET_KEY.')
  process.exit(1)
}
const stripe = new Stripe(key)
console.log(`Stripe en modo ${key.startsWith('sk_live_') ? 'REAL' : 'prueba'}.`)

// Pesos al mes; el anual cobra 10 meses.
const MXN = { arranque: 399, negocio: 799, profesional: 1499, multisede: 2999, seat: 399 }
const MONTHLY = {
  arranque: process.env.STRIPE_PRICE_ARRANQUE,
  negocio: process.env.STRIPE_PRICE_NEGOCIO,
  profesional: process.env.STRIPE_PRICE_PROFESIONAL,
  multisede: process.env.STRIPE_PRICE_MULTISEDE,
  seat: process.env.STRIPE_PRICE_SEAT_V2,
}

async function addMxn(priceId, pesos, label) {
  const price = await stripe.prices.retrieve(priceId, { expand: ['currency_options'] })
  const want = Math.round(pesos * 100)
  const has = price.currency_options?.mxn?.unit_amount
  if (has === want) return console.log(`• ${label}: ya tenía $${pesos} MXN (${price.id})`)
  if (has != null) {
    // Un importe distinto no se pisa: cambiar un precio en uso afecta a quien ya paga.
    return console.warn(`! ${label}: tiene $${has / 100} MXN y se esperaba $${pesos}. Revisar a mano.`)
  }
  await stripe.prices.update(priceId, { currency_options: { mxn: { unit_amount: want } } })
  console.log(`✓ ${label}: agregado $${pesos} MXN (${price.id})`)
}

async function main() {
  for (const [k, id] of Object.entries(MONTHLY)) {
    if (!id) {
      console.warn(`! Falta el price id mensual de ${k}.`)
      continue
    }
    await addMxn(id, MXN[k], `${k} mensual`)
  }

  const keys = Object.keys(MXN).map((k) => `chatventi_${k}_year`)
  const annual = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 20 })
  for (const pr of annual.data) {
    const k = pr.lookup_key.replace('chatventi_', '').replace('_year', '')
    await addMxn(pr.id, MXN[k] * 10, `${k} anual`)
  }
  if (annual.data.length < keys.length) console.warn(`! Solo hay ${annual.data.length} de ${keys.length} precios anuales.`)

  const rates = await stripe.taxRates.list({ active: true, limit: 100 })
  const iva = rates.data.find((r) => r.metadata?.chatventi === 'iva_mx')
  if (iva) return console.log(`• IVA ya existía (${iva.id}, ${iva.percentage} %).`)
  const created = await stripe.taxRates.create({
    display_name: 'IVA',
    description: 'IVA México 16 %',
    percentage: 16,
    inclusive: false,
    country: 'MX',
    jurisdiction: 'MX',
    metadata: { chatventi: 'iva_mx' },
  })
  console.log(`✓ IVA creado (${created.id}).`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
