// =====================================================================
// ChatVenti · Catálogo de planes (compartido cliente + servidor)
//   NO contiene secretos. Los price IDs de Stripe viven en env (stripe.ts).
//
//   MODELO (Fase 1, 2026-08-06): precio por CAPACIDAD del negocio
//   (profesionales, accesos, canales) + una BOLSA DE CRÉDITO DE USO.
//   WhatsApp con IA va en TODOS los planes: es la promesa de la home.
//
//   🔴 POR QUÉ LA BOLSA VA EN DINERO Y NO EN MENSAJES
//   Desde el 1-oct-2026 Meta cobra los mensajes de servicio dentro de la
//   ventana de 24 h (hoy gratis). Una bolsa medida en MENSAJES ata el plan a
//   la tarifa de un país: los mismos 1,200 mensajes cuestan $10.20 en México,
//   $24.00 en España y $66.00 en Alemania — el mismo plan daría 62 % de
//   margen aquí y PÉRDIDA allá. Con la bolsa en CRÉDITO, el coste variable
//   máximo es una constante que elegimos nosotros; lo que cambia entre países
//   es cuántos mensajes rinde. Un solo catálogo mundial, margen garantizado.
// =====================================================================

export const CURRENCY = 'usd' as const

// Prueba GRATIS sin tarjeta (días desde el registro).
// 🔴 DEBE coincidir con el `interval` de create_organization_with_owner (v1 y
// v2) en la base: ahí es donde se sella trial_ends_at al crear la org. Si se
// cambia aquí sin cambiarlo allí, la web promete una cosa y el trial dura otra.
// Última sincronización: migración 20260805010000 (10 → 14 días).
export const TRIAL_DAYS = 14

// Días desde el registro tras los cuales, sin suscripción, se borran los datos
// operativos del negocio (se conserva la cuenta del dueño).
export const DATA_RETENTION_DAYS = 30

// Promo de conversión: 30% de descuento por 3 meses. El código se envía en los
// correos del funnel y se aplica en el checkout (allow_promotion_codes).
export const PROMO_CODE = 'BIENVENIDO30'
export const PROMO_LABEL = '30% de descuento durante 3 meses'

// ---------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------

export type PlanId = 'arranque' | 'negocio' | 'profesional' | 'multisede'

export interface Plan {
  id: PlanId
  name: string
  priceUsd: number
  /** Frase de una línea para la tarjeta de precios. */
  tagline: string
  /** Canales por los que responde el agente IA. */
  aiChannels: string[]
  /** Profesionales/recursos agendables. null = sin límite. */
  maxResources: number | null
  /**
   * Accesos de equipo TOTALES incluidos, contando al dueño. Es el mismo
   * número que devuelve plan_included_seats() en la base (migración
   * 20260806200000): si se cambia aquí, se cambia allá.
   */
  maxSeats: number | null
  /**
   * Crédito de uso incluido al mes, en USD. Cubre los mensajes que Meta nos
   * cobra MÁS el consumo del modelo de IA. Es el techo del coste variable.
   */
  usageCreditUsd: number
  /** Superpoderes del agente: lee comprobantes, oye notas de voz, encuesta. */
  hasSuperpowers: boolean
  /** Módulo "Tu App" (PWA de marca) incluido sin coste adicional. */
  includesPwa: boolean
  /** Dominio propio incluido sin coste adicional. */
  includesDomain: boolean
  popular: boolean
  /** Bullets de la tarjeta de precios, en orden. */
  features: string[]
}

// Margen bruto MÍNIMO (crédito agotado, Stripe e infraestructura descontados):
// 64 / 62 / 63 / 63 %. Con consumo real (~55 % del crédito): 75-80 %.
// Ver monthlyMarginUsd().
export const PLANS: Plan[] = [
  {
    id: 'arranque',
    name: 'Arranque',
    priceUsd: 19,
    tagline: 'Para quien trabaja solo y no quiere perder ni una cita.',
    aiChannels: ['WhatsApp', 'Widget web', 'Telegram'],
    maxResources: 1,
    maxSeats: 1,
    usageCreditUsd: 6,
    hasSuperpowers: false,
    includesPwa: false,
    includesDomain: false,
    popular: false,
    features: [
      'Recepcionista IA por WhatsApp, web y Telegram',
      'Agenda online y reservas desde tu web',
      'CRM de clientes con historial',
      '1 profesional · 1 acceso',
      'Recordatorios automáticos de cita',
    ],
  },
  {
    id: 'negocio',
    name: 'Negocio',
    priceUsd: 39,
    tagline: 'Para un equipo pequeño que ya no da abasto contestando.',
    aiChannels: ['WhatsApp', 'Widget web', 'Telegram'],
    maxResources: 3,
    maxSeats: 2,
    usageCreditUsd: 13,
    hasSuperpowers: true,
    includesPwa: false,
    includesDomain: false,
    popular: true,
    features: [
      'Todo lo del plan Arranque',
      'Hasta 3 profesionales · 2 accesos',
      'Superpoderes: lee comprobantes, oye notas de voz, encuesta al cliente',
      'Rescate automático de interesados que no cerraron',
      'Resumen diario de tu negocio',
    ],
  },
  {
    id: 'profesional',
    name: 'Profesional',
    priceUsd: 79,
    tagline: 'Para clínicas y estéticas con varios profesionales.',
    aiChannels: ['WhatsApp', 'Instagram', 'Messenger', 'Widget web', 'Telegram'],
    maxResources: 10,
    maxSeats: 5,
    usageCreditUsd: 26,
    hasSuperpowers: true,
    includesPwa: true,
    includesDomain: false,
    popular: false,
    features: [
      'Todo lo del plan Negocio',
      'Instagram y Messenger además de WhatsApp*',
      'Hasta 10 profesionales · 5 accesos',
      '"Tu App" incluida: app de marca para tus clientes',
      'Expediente del cliente con archivos y recordatorios recurrentes',
    ],
  },
  {
    id: 'multisede',
    name: 'Multi-sede',
    priceUsd: 149,
    tagline: 'Para varios locales bajo una misma marca.',
    aiChannels: ['WhatsApp', 'Instagram', 'Messenger', 'Widget web', 'Telegram'],
    maxResources: null,
    maxSeats: 10,
    usageCreditUsd: 50,
    hasSuperpowers: true,
    includesPwa: true,
    includesDomain: true,
    popular: false,
    features: [
      'Todo lo del plan Profesional',
      'Profesionales ilimitados · 10 accesos',
      'Dominio propio incluido',
      'Crédito de uso ampliado',
      'Soporte prioritario',
    ],
  },
]

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

// ---------------------------------------------------------------------
// Add-ons (USD/mes)
// ---------------------------------------------------------------------

/** "Tu App": PWA de marca del negocio para sus clientes finales. */
export const ADDON_PWA_USD = 19
/** Conectar el dominio propio del dueño (incluido en Multi-sede). */
export const ADDON_DOMAIN_USD = 8
/** Acceso de equipo ADICIONAL a los que ya trae el plan. */
export const ADDON_SEAT_USD = 19

/**
 * Precio de entrada, para el copy de las landings ("Desde $19 USD/mes").
 * Derivado del catálogo: si cambia el plan más barato, la home y las 5
 * landings /para/* siguen diciendo la verdad solas.
 */
export const STARTER_PRICE_USD = Math.min(...PLANS.map((p) => p.priceUsd))

// ---------------------------------------------------------------------
// Coste del uso (Meta + IA)
// ---------------------------------------------------------------------

/**
 * Tarifa por mensaje saliente de WhatsApp, en USD, por mercado.
 * ✅ VERIFICADO el 2026-08-06 en el tarifario oficial de Meta
 * (whatsappbusiness.com/products/platform-pricing, categoría "Utilidad", USD).
 * Son las tarifas VIGENTES: Meta anunció que desde el 1-oct-2026 los mensajes
 * de servicio se cobran "a la misma tarifa que utilidad", y que publica las
 * tarifas definitivas de octubre ANTES DEL 1-SEP-2026.
 *
 * 🔴 RECORDATORIO 1-SEP-2026: revisar el tarifario y actualizar esta tabla
 * (y recalibrar usageCreditUsd si las tarifas cambian con fuerza). Meta solo
 * puede cambiar precios el primer día de cada trimestre.
 */
export const META_RATE_USD: Record<string, number> = {
  MX: 0.0085,
  ES: 0.02,
  DE: 0.055,
}
export const META_RATE_FALLBACK_USD = 0.02

export function metaRateUsd(countryCode: string | null | undefined): number {
  return META_RATE_USD[countryCode ?? ''] ?? META_RATE_FALLBACK_USD
}

/** Coste aproximado de un turno del agente (gpt-4o-mini vía OpenRouter). */
export const AI_TURN_COST_USD = 0.0014

/**
 * Coste de uso de una conversación completa: los mensajes que le mandamos al
 * cliente más los turnos que gasta el modelo. Alimenta el panel de costes y
 * el dimensionado del crédito de cada plan.
 */
export function conversationCostUsd(opts: {
  countryCode?: string | null
  outboundMessages?: number
  aiTurns?: number
}): number {
  const msgs = opts.outboundMessages ?? 3
  const turns = opts.aiTurns ?? 6
  return msgs * metaRateUsd(opts.countryCode) + turns * AI_TURN_COST_USD
}

/** Conversaciones aproximadas que cubre el crédito del plan en un mercado. */
export function conversationsIncluded(planId: PlanId, countryCode?: string | null): number {
  return Math.floor(planById(planId).usageCreditUsd / conversationCostUsd({ countryCode }))
}

/** Consumo por encima del crédito incluido. Se repercute AL COSTO, sin margen. */
export function overageUsd(planId: PlanId, usedUsd: number): number {
  return Number(Math.max(0, usedUsd - planById(planId).usageCreditUsd).toFixed(2))
}

// ---------------------------------------------------------------------
// Total mensual y margen
// ---------------------------------------------------------------------

/**
 * Total mensual estimado (USD) para la calculadora de la página de precios y
 * el correo de confirmación del webhook de Stripe.
 * `extraSeats` son accesos POR ENCIMA de los que ya incluye el plan.
 */
export function monthlyTotalUsd(opts: {
  plan: PlanId
  pwa?: boolean
  domain?: boolean
  extraSeats?: number
}): number {
  const plan = planById(opts.plan)
  return (
    plan.priceUsd +
    (opts.pwa && !plan.includesPwa ? ADDON_PWA_USD : 0) +
    (opts.domain && !plan.includesDomain ? ADDON_DOMAIN_USD : 0) +
    (opts.extraSeats ?? 0) * ADDON_SEAT_USD
  )
}

/** Accesos de equipo permitidos = los del plan + los add-ons contratados. */
export function seatLimit(planId: PlanId | null | undefined, extraSeats: number): number | null {
  if (!planId) return 1 + extraSeats // legado: 1 (dueño) + team_seats
  const base = planById(planId).maxSeats
  return base === null ? null : base + extraSeats
}

// Comisión de Stripe MX para tarjeta internacional y prorrateo de infra
// (Vercel Pro + Supabase Pro entre ~500 negocios). Solo para análisis/admin.
export const STRIPE_PCT = 0.036
export const STRIPE_FIXED_USD = 0.16
export const INFRA_PER_ORG_USD = 0.09

/**
 * Lo que queda de un plan tras Stripe, el crédito de uso y la infraestructura.
 * `creditUsedRatio` = cuánto del crédito consume el negocio (1 = lo agota;
 * la media observada ronda 0.55). Alimenta el panel de márgenes del admin.
 */
export function monthlyMarginUsd(planId: PlanId, creditUsedRatio = 1): number {
  const plan = planById(planId)
  const stripe = plan.priceUsd * STRIPE_PCT + STRIPE_FIXED_USD
  const usage = plan.usageCreditUsd * Math.min(1, Math.max(0, creditUsedRatio))
  return Number((plan.priceUsd - stripe - usage - INFRA_PER_ORG_USD).toFixed(2))
}

// ---------------------------------------------------------------------
// Compatibilidad con las suscripciones del modelo viejo
//   Mientras `subscriptions.ai_tier` exista, el webhook puede encontrarse
//   filas o price IDs del catálogo anterior. Se retira en la fase CONTRACT.
// ---------------------------------------------------------------------

export type LegacyAiTierId = 'none' | '300' | '1000' | '3000'

/** Plan equivalente para una suscripción creada con el catálogo viejo.
 *  Mismo mapeo que el backfill de la migración 20260806200000. */
export function planFromLegacyTier(tier: string | null | undefined): PlanId {
  switch (tier) {
    case '3000':
      return 'multisede'
    case '1000':
      return 'profesional'
    case '300':
      return 'negocio'
    default:
      return 'arranque'
  }
}

// ---------------------------------------------------------------------

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
