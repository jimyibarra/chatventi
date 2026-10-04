import Stripe from 'stripe'
import { planFromLegacyTier, type BillingInterval, type PlanId } from '@/features/billing/plans'

/**
 * Cliente Stripe (server-only), inicializado de forma PEREZOSA. El constructor
 * del SDK LANZA ("Neither apiKey nor config.authenticator provided") si la key
 * está vacía. Si se construyera al importar el módulo, `next build` rompería
 * cuando STRIPE_SECRET_KEY no está en el entorno de build (colecta page data de
 * las rutas que lo importan). Se crea en la primera llamada real, ya con la env
 * presente. `.trim()` evita que espacios invisibles rompan la firma.
 */
let stripeSingleton: Stripe | null = null
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() ?? '')
  }
  return stripeSingleton
}

/**
 * Tasa de IVA de México (16 %, se suma al precio: «más IVA»). Se busca por
 * metadata y se crea si falta, así funciona igual en modo prueba y en real.
 */
let ivaCache: string | null = null
export async function ivaTaxRateId(): Promise<string> {
  if (ivaCache) return ivaCache
  const stripe = getStripe()
  const rates = await stripe.taxRates.list({ active: true, limit: 100 })
  const found = rates.data.find((r) => r.metadata?.chatventi === 'iva_mx')
  const rate =
    found ??
    (await stripe.taxRates.create({
      display_name: 'IVA',
      description: 'IVA México 16 %',
      percentage: 16,
      inclusive: false,
      country: 'MX',
      jurisdiction: 'MX',
      metadata: { chatventi: 'iva_mx' },
    }))
  ivaCache = rate.id
  return rate.id
}

/** Secreto para verificar la firma del webhook. .trim() obligatorio. */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? ''

// ---------------------------------------------------------------------
// Price IDs (env). NO son secretos, pero se resuelven server-side para
// centralizar el mapeo plan <-> price.
//
// Catálogo 2026-08 (Fase 1): 4 planes por capacidad + add-ons.
// ---------------------------------------------------------------------
export const PRICE_ARRANQUE = process.env.STRIPE_PRICE_ARRANQUE ?? ''
export const PRICE_NEGOCIO = process.env.STRIPE_PRICE_NEGOCIO ?? ''
export const PRICE_PROFESIONAL = process.env.STRIPE_PRICE_PROFESIONAL ?? ''
export const PRICE_MULTISEDE = process.env.STRIPE_PRICE_MULTISEDE ?? ''
export const PRICE_PWA = process.env.STRIPE_PRICE_PWA ?? ''
export const PRICE_SEAT = process.env.STRIPE_PRICE_SEAT_V2 ?? ''
export const PRICE_DOMAIN_V2 = process.env.STRIPE_PRICE_DOMAIN_V2 ?? ''

// Catálogo LEGADO (pre Fase 1). Se conservan para que el webhook pueda
// reconstruir suscripciones antiguas que sigan vivas en Stripe. Se retiran
// en la fase CONTRACT junto con subscriptions.ai_tier.
export const PRICE_STARTER = process.env.STRIPE_PRICE_STARTER ?? ''
const PRICE_AI_300 = process.env.STRIPE_PRICE_AI_300 ?? ''
const PRICE_AI_1000 = process.env.STRIPE_PRICE_AI_1000 ?? ''
const PRICE_AI_3000 = process.env.STRIPE_PRICE_AI_3000 ?? ''
const PRICE_DOMAIN_V1 = process.env.STRIPE_PRICE_DOMAIN ?? ''
export const PRICE_TEAM = process.env.STRIPE_PRICE_TEAM ?? ''

/** plan -> price id de Stripe. Vacío si la env no está cargada. */
export function planPriceId(plan: PlanId): string {
  switch (plan) {
    case 'arranque':
      return PRICE_ARRANQUE
    case 'negocio':
      return PRICE_NEGOCIO
    case 'profesional':
      return PRICE_PROFESIONAL
    case 'multisede':
      return PRICE_MULTISEDE
  }
}

// ---------------------------------------------------------------------
// Precios ANUALES: se resuelven por `lookup_key` en Stripe, no por variable de
// entorno. Así un precio nuevo no exige tocar la configuración del hosting, y
// el mismo código vale para el modo de prueba y el real (basta con crear en
// cada uno precios con estas claves).
// ---------------------------------------------------------------------
const ANNUAL_LOOKUP = /^chatventi_(arranque|negocio|profesional|multisede|seat)_year$/

export function annualLookupKey(item: PlanId | 'seat'): string {
  return `chatventi_${item}_year`
}

let annualCache: Record<string, string> | null = null

/** lookup_key -> price id de los precios anuales activos (se cachea en memoria). */
export async function annualPriceIds(): Promise<Record<string, string>> {
  if (annualCache) return annualCache
  const keys = (['arranque', 'negocio', 'profesional', 'multisede', 'seat'] as const).map(annualLookupKey)
  const list = await getStripe().prices.list({ lookup_keys: keys, active: true, limit: 20 })
  const found: Record<string, string> = {}
  for (const price of list.data) if (price.lookup_key) found[price.lookup_key] = price.id
  // Solo se cachea un catálogo completo: uno a medias obligaría a redesplegar.
  if (keys.every((k) => found[k])) annualCache = found
  return found
}

/**
 * Mapeo inverso price ids -> significado, para reconstruir el estado de la
 * suscripción desde los items de Stripe en el webhook (fuente de verdad).
 * Entiende AMBOS catálogos: el nuevo (plan directo) y el legado (Starter +
 * tier de IA), que se traduce al plan equivalente con planFromLegacyTier.
 */
export function describeSubscriptionItems(
  items: { priceId: string; quantity: number; lookupKey?: string | null; interval?: string | null }[]
): {
  planId: PlanId | null
  /** Periodicidad de la suscripción (la de su primer item). */
  interval: BillingInterval
  hasPwa: boolean
  hasDomain: boolean
  extraSeats: number
  /** ai_tier legado equivalente, para mantener la columna vieja coherente. */
  legacyAiTier: 'none' | '300' | '1000' | '3000'
} {
  let planId: PlanId | null = null
  let hasPwa = false
  let hasDomain = false
  let extraSeats = 0
  let legacyAiTier: 'none' | '300' | '1000' | '3000' = 'none'

  for (const { priceId, quantity, lookupKey } of items) {
    if (!priceId) continue
    // Precios anuales (por lookup_key)
    const annual = ANNUAL_LOOKUP.exec(lookupKey ?? '')?.[1]
    if (annual === 'seat') extraSeats += quantity
    else if (annual) planId = annual as PlanId
    // Catálogo nuevo
    else if (priceId === PRICE_ARRANQUE) planId = 'arranque'
    else if (priceId === PRICE_NEGOCIO) planId = 'negocio'
    else if (priceId === PRICE_PROFESIONAL) planId = 'profesional'
    else if (priceId === PRICE_MULTISEDE) planId = 'multisede'
    else if (priceId === PRICE_PWA) hasPwa = true
    else if (priceId === PRICE_SEAT) extraSeats += quantity
    else if (priceId === PRICE_DOMAIN_V2) hasDomain = true
    // Catálogo legado
    else if (priceId === PRICE_AI_300) legacyAiTier = '300'
    else if (priceId === PRICE_AI_1000) legacyAiTier = '1000'
    else if (priceId === PRICE_AI_3000) legacyAiTier = '3000'
    else if (priceId === PRICE_DOMAIN_V1) hasDomain = true
    else if (priceId === PRICE_TEAM) extraSeats += quantity
    // PRICE_STARTER: base legada, no aporta información por sí sola.
  }

  // Suscripción legada sin plan nuevo: se traduce al plan equivalente para
  // que plan_id quede poblado (mismo mapeo que el backfill de la migración).
  if (!planId && items.some((i) => i.priceId === PRICE_STARTER)) {
    planId = planFromLegacyTier(legacyAiTier)
  }

  const interval: BillingInterval = items[0]?.interval === 'year' ? 'year' : 'month'
  return { planId, interval, hasPwa, hasDomain, extraSeats, legacyAiTier }
}
