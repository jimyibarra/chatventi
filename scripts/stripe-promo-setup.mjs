// =====================================================================
// ChatVenti · Crea el cupón + código de promoción de conversión (idempotente).
//   Uso: node --env-file=.env.local scripts/stripe-promo-setup.mjs
//   Cupón: 30% OFF durante 3 meses.  Código: BIENVENIDO30
//   El checkout ya tiene allow_promotion_codes:true, así que el cliente lo
//   escribe al suscribirse. Debe coincidir con PROMO_CODE en plans.ts.
// =====================================================================
import Stripe from 'stripe'

const key = (process.env.STRIPE_SECRET_KEY || '').trim()
if (!key) {
  console.error('Falta STRIPE_SECRET_KEY.')
  process.exit(1)
}
// La API por defecto (2026+) rechaza `coupon` en promotionCodes.create; 2024-06-20 sí lo acepta.
const stripe = new Stripe(key, { apiVersion: '2024-06-20' })

const PROMO_CODE = 'BIENVENIDO30'
const PERCENT_OFF = 30
const MONTHS = 3
const COUPON_LOOKUP = 'cv_bienvenido_30_3m' // en el name, para reutilizar

async function main() {
  // ¿Ya existe el código de promoción?
  const existing = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 })
  if (existing.data.length) {
    const pc = existing.data[0]
    console.log(`• Código ${PROMO_CODE} ya existe (${pc.id}, activo=${pc.active}).`)
    return
  }

  // Reutiliza el cupón por name si ya se creó antes; si no, créalo.
  const coupons = await stripe.coupons.list({ limit: 100 })
  let coupon = coupons.data.find((c) => c.name === COUPON_LOOKUP)
  if (!coupon) {
    coupon = await stripe.coupons.create({
      name: COUPON_LOOKUP,
      percent_off: PERCENT_OFF,
      duration: 'repeating',
      duration_in_months: MONTHS,
    })
    console.log(`• Cupón creado: ${coupon.id} (${PERCENT_OFF}% x ${MONTHS} meses).`)
  } else {
    console.log(`• Cupón reutilizado: ${coupon.id}.`)
  }

  const pc = await stripe.promotionCodes.create({ coupon: coupon.id, code: PROMO_CODE })
  console.log(`\n✅ Código de promoción listo: ${pc.code} (${pc.id})`)
  console.log(`   ${PERCENT_OFF}% de descuento durante ${MONTHS} meses. Debe coincidir con PROMO_CODE en plans.ts.`)
}

main().catch((e) => {
  console.error('❌ Error:', e.message || e)
  process.exit(1)
})
