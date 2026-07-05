// =====================================================================
// ChatVenti · Fase 7 · Catálogo de planes (compartido cliente + servidor)
//   NO contiene secretos. Los price IDs de Stripe viven en env (stripe.ts).
//   Modelo híbrido (paridad CitaFlow, recortado v1): base Starter + módulo
//   opcional "Recepcionista IA" por volumen (tiers fijos) + add-ons.
// =====================================================================

export const CURRENCY = 'usd' as const
export const TRIAL_DAYS = 14

/** Precio de la base "ChatVenti Starter" (siempre incluida), en USD/mes. */
export const STARTER_PRICE_USD = 29

/** Add-ons opcionales (USD/mes). */
export const ADDON_DOMAIN_USD = 5
export const ADDON_TEAM_USD = 19

export type AiTierId = 'none' | '300' | '1000' | '3000'

export interface AiTier {
  id: AiTierId
  label: string
  detail: string
  priceUsd: number
  popular: boolean
}

/** Tiers del módulo Recepcionista IA (Chat: WhatsApp + Telegram + Widget). */
export const AI_TIERS: AiTier[] = [
  { id: 'none', label: 'No, solo agenda', detail: 'Mis clientes reservan por la web y por email', priceUsd: 0, popular: false },
  { id: '300', label: 'Sí · poco volumen', detail: '~300 conversaciones / mes', priceUsd: 19, popular: false },
  { id: '1000', label: 'Sí · volumen medio', detail: '~1.000 conversaciones / mes', priceUsd: 39, popular: true },
  { id: '3000', label: 'Sí · volumen alto', detail: '~3.000 conversaciones / mes', priceUsd: 109, popular: false },
]

export function aiTierById(id: string | null | undefined): AiTier {
  return AI_TIERS.find((t) => t.id === id) ?? AI_TIERS[0]
}

/** Total mensual estimado (USD) para mostrar en la calculadora. */
export function monthlyTotalUsd(opts: {
  aiTier: AiTierId
  domain?: boolean
  teamSeats?: number
}): number {
  return (
    STARTER_PRICE_USD +
    aiTierById(opts.aiTier).priceUsd +
    (opts.domain ? ADDON_DOMAIN_USD : 0) +
    (opts.teamSeats ?? 0) * ADDON_TEAM_USD
  )
}

/** Etiqueta legible para el estado de la suscripción. */
export const STATUS_LABELS: Record<string, string> = {
  none: 'Sin suscripción',
  trialing: 'En prueba gratis',
  active: 'Activa',
  past_due: 'Pago pendiente',
  unpaid: 'Sin pagar',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
}
