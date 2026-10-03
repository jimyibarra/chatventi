// =====================================================================
// ChatVenti · Catálogo de planes (compartido cliente + servidor)
//   NO contiene secretos. Los price IDs de Stripe viven en env (stripe.ts).
//
//   MODELO (Fase 1, 2026-08-06): precio por CAPACIDAD del negocio
//   (profesionales, accesos, canales) + una BOLSA DE CRÉDITO DE USO.
//   WhatsApp con IA va en TODOS los planes: es la promesa de la home.
//
//   🔴 QUÉ CUBRE HOY LA BOLSA (2026-10-03): SOLO EL USO DE IA.
//   Los mensajes de WhatsApp se los factura Meta directamente a cada negocio.
//   ChatVenti es Tech Provider y sus términos (31-jul-2026, cláusula "No
//   Resale") prohíben pagar el consumo de WhatsApp del cliente con crédito
//   propio o cobrarle una tarifa por él. Lo que sí se puede cobrar —y se
//   cobra— es nuestro propio servicio: las respuestas de la recepcionista.
//   Ver usageOverage(). El razonamiento de abajo sigue valiendo si algún día
//   se opera con un socio que ponga la línea de crédito.
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
  /**
   * Canales por los que responde el agente IA. Desde el 2026-10-03 Instagram y
   * Messenger van en TODOS los planes: Meta no cobra por esos mensajes y son el
   * gancho para que el negocio acepte poner su tarjeta en Meta para WhatsApp.
   */
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
   * Crédito de uso incluido al mes, en USD. Hoy cubre el consumo del modelo
   * de IA (WhatsApp lo factura Meta al negocio). Es el techo del coste
   * variable; en respuestas, ver aiRepliesIncluded().
   */
  usageCreditUsd: number
  /** Superpoderes del agente: lee comprobantes, oye notas de voz, encuesta. */
  hasSuperpowers: boolean
  /**
   * Módulo "Tu App" (PWA de marca) incluido sin coste adicional.
   * 🔴 AÚN NO EXISTE (2026-10-03): ni se anuncia ni se cobra. La bandera se
   * conserva porque ya hay suscripciones sincronizadas con ella.
   */
  includesPwa: boolean
  /** Dominio propio incluido. 🔴 Tampoco existe todavía: mismo criterio. */
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
    aiChannels: ['WhatsApp', 'Instagram', 'Messenger', 'Widget web', 'Telegram'],
    maxResources: 1,
    maxSeats: 1,
    usageCreditUsd: 6,
    hasSuperpowers: false,
    includesPwa: false,
    includesDomain: false,
    popular: false,
    features: [
      'Recepcionista IA por WhatsApp, Instagram, Messenger, web y Telegram',
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
    aiChannels: ['WhatsApp', 'Instagram', 'Messenger', 'Widget web', 'Telegram'],
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
      'Hasta 10 profesionales · 5 accesos',
      'Expediente del cliente con archivos y recordatorios recurrentes',
      'El doble de uso de IA incluido que en Negocio',
    ],
  },
  {
    id: 'multisede',
    name: 'Multi-sede',
    priceUsd: 149,
    tagline: 'Para equipos grandes que atienden mucho volumen.',
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
      'El mayor uso de IA incluido de todos los planes',
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

// 🔴 "Tu App" y el dominio propio NO se venden hasta estar construidos: sus
// importes siguen aquí solo para leer suscripciones que ya los traigan.
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
 * Tarifa por mensaje de SERVICIO de WhatsApp (las respuestas del agente dentro
 * de la ventana de 24 h), en USD, por mercado.
 * ✅ VERIFICADO el 2026-10-02 en la hoja de tarifas oficial de Meta con vigencia
 * 1-oct-2026 (developers.facebook.com → WhatsApp → Pricing → Rate cards, USD):
 * la columna "Service" coincide con "Utility" en cada mercado.
 *
 * 🔴 PRÓXIMA REVISIÓN 1-DIC-2026: Meta solo cambia precios el primer día de
 * cada trimestre y avisa un mes antes. Si la tabla cambia con fuerza,
 * recalibrar usageCreditUsd.
 */
export const META_RATE_USD: Record<string, number> = {
  MX: 0.0085,
  ES: 0.02,
  DE: 0.055,
}
export const META_RATE_FALLBACK_USD = 0.02

/**
 * Mensajes de servicio que Meta NO cobra cada mes, POR NÚMERO de teléfono
 * (vigente desde el 1-oct-2026; no se acumulan de un mes a otro). Agotado el
 * cupo, Meta solo sigue entregando si la cuenta de WhatsApp tiene método de pago.
 * Es ahorro nuestro, no del cliente: lo que se repercute sigue saliendo de
 * conversationCostUsd(), así que este cupo es margen adicional.
 */
export const META_FREE_SERVICE_MESSAGES_PER_NUMBER = 1000

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

// ---------------------------------------------------------------------
// Uso de IA: lo incluido y el excedente
// ---------------------------------------------------------------------

/**
 * Recargo sobre el costo de cada respuesta de IA que rebasa lo incluido.
 * 0.30 = costo + 30 %. Es NUESTRO servicio (la recepcionista), no una tarifa
 * por mensaje de WhatsApp: eso último lo prohíben los términos de Meta.
 */
export const USAGE_COMMISSION_PCT = 0.3

/** Respuestas de la recepcionista que el plan trae incluidas cada mes. */
export function aiRepliesIncluded(planId: PlanId): number {
  return Math.floor(planById(planId).usageCreditUsd / AI_TURN_COST_USD)
}

/** Precio de cada respuesta adicional (costo + recargo), en USD. */
export const EXTRA_REPLY_PRICE_USD = AI_TURN_COST_USD * (1 + USAGE_COMMISSION_PCT)

/**
 * Excedente de un mes. Una sola fórmula para el panel del cliente y para el
 * cierre que carga en Stripe: lo que el cliente ve es lo que se le cobra.
 */
export function usageOverage(
  planId: PlanId,
  aiReplies: number
): { included: number; extra: number; chargeUsd: number } {
  const included = aiRepliesIncluded(planId)
  const extra = Math.max(0, aiReplies - included)
  return { included, extra, chargeUsd: Number((extra * EXTRA_REPLY_PRICE_USD).toFixed(2)) }
}

// ---------------------------------------------------------------------
// Plan anual: 12 meses por el precio de 10
// ---------------------------------------------------------------------

export type BillingInterval = 'month' | 'year'
export const ANNUAL_MONTHS_CHARGED = 10
export const ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_CHARGED

/** Importe del periodo (mes o año) para un precio mensual dado. */
export function periodPriceUsd(monthlyUsd: number, interval: BillingInterval): number {
  return interval === 'year' ? monthlyUsd * ANNUAL_MONTHS_CHARGED : monthlyUsd
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
