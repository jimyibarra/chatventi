import Stripe from 'stripe'
import type { AiTierId } from '@/features/billing/plans'

/**
 * Cliente Stripe (server-only). Se construye siempre; el SDK solo falla al
 * hacer una llamada real si la key es inválida/vacía, no al importar → seguro
 * en build. `.trim()` evita que espacios invisibles rompan la firma.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() ?? '')

/** Secreto para verificar la firma del webhook. .trim() obligatorio. */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? ''

// ---------------------------------------------------------------------
// Price IDs (env). NO son secretos, pero se resuelven server-side para
// centralizar el mapeo tier <-> price.
// ---------------------------------------------------------------------
export const PRICE_STARTER = process.env.STRIPE_PRICE_STARTER ?? ''
export const PRICE_AI_300 = process.env.STRIPE_PRICE_AI_300 ?? ''
export const PRICE_AI_1000 = process.env.STRIPE_PRICE_AI_1000 ?? ''
export const PRICE_AI_3000 = process.env.STRIPE_PRICE_AI_3000 ?? ''
export const PRICE_DOMAIN = process.env.STRIPE_PRICE_DOMAIN ?? ''
export const PRICE_TEAM = process.env.STRIPE_PRICE_TEAM ?? ''

/** tier IA -> price id de Stripe. 'none' no tiene price (no se agrega línea). */
export function aiTierPriceId(tier: AiTierId): string | null {
  switch (tier) {
    case '300':
      return PRICE_AI_300
    case '1000':
      return PRICE_AI_1000
    case '3000':
      return PRICE_AI_3000
    default:
      return null
  }
}

/**
 * Mapeo inverso price id -> significado, para reconstruir el estado de la
 * suscripción desde los items de Stripe en el webhook (fuente de verdad).
 */
export function describeSubscriptionItems(priceIds: string[]): {
  aiTier: AiTierId
  hasDomain: boolean
  teamSeatsPriceCount: number
} {
  let aiTier: AiTierId = 'none'
  let hasDomain = false
  for (const pid of priceIds) {
    if (pid && pid === PRICE_AI_300) aiTier = '300'
    else if (pid && pid === PRICE_AI_1000) aiTier = '1000'
    else if (pid && pid === PRICE_AI_3000) aiTier = '3000'
    else if (pid && pid === PRICE_DOMAIN) hasDomain = true
  }
  return { aiTier, hasDomain, teamSeatsPriceCount: 0 }
}
