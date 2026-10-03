import 'server-only'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

// Promoción de conversión (fin de la prueba gratis). La fuente de verdad es
// STRIPE: el código promocional marcado con metadata.chatventi = 'trial_promo'.
// Se configura en /admin/promocion; aquí solo se lee. Así el correo, la pantalla
// de Facturación y el checkout nunca dicen cosas distintas, y al pasar Stripe a
// modo real basta con guardarla una vez desde el admin.

export const PROMO_TAG = 'trial_promo'

export interface TrialPromo {
  code: string
  percent: number
  months: number
  /** «30% de descuento durante 3 meses». */
  label: string
  active: boolean
  promoId: string
  couponId: string
  redeemed: number
}

export function promoLabel(percent: number, months: number): string {
  return `${percent}% de descuento durante ${months} ${months === 1 ? 'mes' : 'meses'}`
}

function toPromo(p: Stripe.PromotionCode): TrialPromo | null {
  const coupon = p.promotion?.coupon
  if (!coupon || typeof coupon === 'string' || !coupon.percent_off) return null
  const months = coupon.duration === 'repeating' ? (coupon.duration_in_months ?? 1) : 1
  return {
    code: p.code,
    percent: coupon.percent_off,
    months,
    label: promoLabel(coupon.percent_off, months),
    active: p.active && coupon.valid,
    promoId: p.id,
    couponId: coupon.id,
    redeemed: p.times_redeemed,
  }
}

/** La promoción marcada más reciente, activa o no (para el admin). */
export async function findTrialPromo(): Promise<TrialPromo | null> {
  const list = await getStripe().promotionCodes.list({ limit: 100, expand: ['data.promotion.coupon'] })
  const tagged = list.data
    .filter((p) => p.metadata?.chatventi === PROMO_TAG)
    .sort((a, b) => b.created - a.created)
  return tagged.length ? toPromo(tagged[0]) : null
}

let cache: { at: number; value: TrialPromo | null } | null = null
const TTL_MS = 5 * 60_000

/**
 * La promoción vigente para mostrar a los clientes, o null si está apagada,
 * no existe o Stripe no responde. Ante la duda NO se muestra: anunciar un
 * código que el checkout rechaza es peor que no anunciar nada.
 */
export async function getActiveTrialPromo(): Promise<TrialPromo | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  try {
    const promo = await findTrialPromo()
    const value = promo?.active ? promo : null
    cache = { at: Date.now(), value }
    return value
  } catch (e) {
    console.error('[promo] no se pudo leer de Stripe', e)
    return null
  }
}

export function clearTrialPromoCache(): void {
  cache = null
}
