// Funciones puras para Conexiones y la API de socios (sin 'server-only' para
// poder probarlas con vitest). La parte que llama a Meta vive en waba-health.ts.

// ---------------------------------------------------------------------
// Estado de la cuenta de WhatsApp (health_status de Graph)
// ---------------------------------------------------------------------

export type CanSend = 'AVAILABLE' | 'LIMITED' | 'BLOCKED'
export type PaymentStatus = 'ok' | 'missing' | 'unknown'
export type WabaHealth = {
  canSend: CanSend | null
  /** 'missing' = Meta reporta un problema con la tarjeta (los mensajes que inicia el negocio no salen). */
  payment: PaymentStatus
  /** Portafolio dueño de la cuenta; sirve para el enlace a pagos. */
  businessId: string | null
}

type HealthError = { error_code?: number; error_description?: string; possible_solution?: string }
type HealthEntity = { entity_type?: string; id?: string; can_send_message?: string; errors?: HealthError[] }
export type HealthResponse = {
  health_status?: { can_send_message?: string; entities?: HealthEntity[] }
  owner_business_info?: { id?: string }
}

// 141006: «There is an error with the payment method» (visto el 16-oct-2026).
// Los otros 1410xx son de la misma familia (pago/línea de crédito).
const PAYMENT_CODES = new Set([141000, 141006, 141010])

const isCanSend = (v: unknown): v is CanSend => v === 'AVAILABLE' || v === 'LIMITED' || v === 'BLOCKED'

export function parseWabaHealth(json: HealthResponse | null | undefined): WabaHealth {
  const hs = json?.health_status
  const canSend = isCanSend(hs?.can_send_message) ? hs.can_send_message : null
  const errors = (hs?.entities ?? []).flatMap((e) => e.errors ?? [])
  const paymentProblem = errors.some(
    (e) => (e.error_code !== undefined && PAYMENT_CODES.has(e.error_code)) || /payment/i.test(e.error_description ?? '')
  )
  const payment: PaymentStatus = paymentProblem ? 'missing' : hs ? 'ok' : 'unknown'
  return { canSend, payment, businessId: json?.owner_business_info?.id ?? null }
}

/** Centro de facturación de Meta con la cuenta de WhatsApp ya elegida (si Meta no la abre, el dueño la elige de la lista). */
export function wabaBillingUrl(wabaId: string, businessId?: string | null): string {
  const u = new URL('https://business.facebook.com/billing_hub/accounts/details/')
  u.searchParams.set('asset_id', wabaId)
  if (businessId) u.searchParams.set('business_id', businessId)
  u.searchParams.set('placement', 'standalone')
  return u.toString()
}

// ---------------------------------------------------------------------
// Datos precargados en la ventana de WhatsApp (Embedded Signup, extras.setup)
// ---------------------------------------------------------------------

export type SignupPrefill = {
  business?: { name: string; email?: string; website?: string; phone?: { code: number; number: string } }
  phone?: { displayName: string; category?: string }
}

/** Giro de ChatVenti → categoría del perfil de WhatsApp (vertical de Meta). Sin equivalente claro: sin categoría. */
const VERTICAL: Record<string, string> = {
  barberia_estetica: 'BEAUTY',
  spa_unas: 'BEAUTY',
  dental: 'HEALTH',
  medico: 'HEALTH',
}

const COUNTRY_CODE: Record<string, number> = { MX: 52, US: 1, CO: 57, AR: 54, CL: 56, PE: 51, ES: 34 }

export function buildSignupPrefill(org: {
  name: string | null
  email?: string | null
  website?: string | null
  phone?: string | null
  country?: string | null
  businessType?: string | null
}): SignupPrefill | null {
  const name = (org.name ?? '').trim().slice(0, 80)
  if (name.length < 2) return null
  const business: NonNullable<SignupPrefill['business']> = { name }
  const email = (org.email ?? '').trim()
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) business.email = email
  const website = (org.website ?? '').trim()
  if (/^https:\/\/[^\s]+$/.test(website)) business.website = website
  const digits = (org.phone ?? '').replace(/\D/g, '')
  const code = COUNTRY_CODE[(org.country ?? 'MX').toUpperCase()]
  // Solo un número nacional limpio (10 dígitos en MX/US): si viene con lada de país u otro formato, mejor no adivinar.
  if (code && digits.length === 10) business.phone = { code, number: digits }
  const category = org.businessType ? VERTICAL[org.businessType] : undefined
  return { business, phone: { displayName: name, ...(category ? { category } : {}) } }
}
