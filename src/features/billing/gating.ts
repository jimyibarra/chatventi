import { createClient } from '@/lib/supabase/server'

/**
 * Gating suave: mientras `BILLING_ENFORCED` != 'true' el cobro NO bloquea
 * funciones (rollout seguro — no dejamos fuera a la org de prueba ni a los
 * early users). Cuando se active, las guardas de la app empiezan a exigir
 * suscripción vigente. Patrón de despliegue por bandera (SastrePro2).
 */
export function isBillingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === 'true'
}

export interface OrgSubscription {
  status: string
  /** Moneda en que Stripe cobra la suscripción (vacía si nunca ha pagado). */
  currency?: string | null
  /** Plan del catálogo 2026-08; null = suscripción del catálogo legado. */
  plan_id: string | null
  ai_tier: string
  has_domain: boolean
  team_seats: number
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
  billing_interval?: string | null
  /** Desde cuándo está pendiente el pago (lo fecha un disparador en la base). */
  past_due_since?: string | null
}

const ACTIVE_STATES = new Set(['trialing', 'active'])

/**
 * Días de gracia con el pago pendiente: el panel y la recepcionista siguen
 * mientras Stripe reintenta el cobro. 🔴 El mismo número está en las guardas
 * de la base (migración 20261007120000): si se cambia aquí, se cambia allá.
 */
export const PAYMENT_GRACE_DAYS = 7

/** Lee la suscripción de la org del usuario autenticado (por RLS). */
export async function getMySubscription(): Promise<OrgSubscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select(
      'status, plan_id, ai_tier, has_domain, team_seats, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, billing_interval, currency, past_due_since'
    )
    .maybeSingle()
  return (data as unknown as OrgSubscription | null) ?? null
}

/** Fin de la gracia de un pago pendiente, o null si no hay pago pendiente. */
export function graceEndsAt(sub: OrgSubscription | null): Date | null {
  if (sub?.status !== 'past_due' || !sub.past_due_since) return null
  return new Date(new Date(sub.past_due_since).getTime() + PAYMENT_GRACE_DAYS * 86_400_000)
}

/**
 * Problema de cobro que el dueño debe atender: 'grace' = sigue todo
 * funcionando hasta `until`; 'blocked' = se acabó la gracia o Stripe ya la
 * dio por no pagada.
 */
export function paymentIssue(sub: OrgSubscription | null): { state: 'grace' | 'blocked'; until: Date | null } | null {
  if (sub?.status === 'unpaid') return { state: 'blocked', until: null }
  const until = graceEndsAt(sub)
  if (!until && sub?.status !== 'past_due') return null
  return until && until > new Date() ? { state: 'grace', until } : { state: 'blocked', until }
}

/** ¿La suscripción da acceso vigente (trial, activa o pago pendiente en gracia)? */
export function subIsActive(sub: OrgSubscription | null): boolean {
  return !!sub && (ACTIVE_STATES.has(sub.status) || paymentIssue(sub)?.state === 'grace')
}

/**
 * ¿Tiene el Recepcionista IA vigente? Catálogo 2026-08: TODOS los planes lo
 * incluyen (plan_id no nulo basta). El criterio legado (ai_tier <> 'none') se
 * conserva para suscripciones sin migrar. Mismo criterio que org_has_ai en la
 * base (migración 20260806200000) — si se cambia aquí, se cambia allá.
 */
export function subHasAi(sub: OrgSubscription | null): boolean {
  return subIsActive(sub) && !!sub && (sub.plan_id !== null || sub.ai_tier !== 'none')
}

export interface OrgTrial {
  trial_ends_at: string | null
  data_deleted_at: string | null
  delete_scheduled_at: string | null
  created_at: string
}

/** ¿Sigue vigente la prueba gratis (sin tarjeta)? */
export function trialActive(org: OrgTrial | null): boolean {
  return !!org?.trial_ends_at && new Date(org.trial_ends_at) > new Date()
}

/**
 * Acceso al panel = prueba vigente O suscripción activa. Al terminar la prueba
 * sin suscripción, el acceso se bloquea (pantalla "Suscríbete"); los datos se
 * conservan hasta el borrado del día 30.
 */
export function hasAppAccess(org: OrgTrial | null, sub: OrgSubscription | null): boolean {
  return subIsActive(sub) || trialActive(org)
}

/** Lee el estado de trial de la org del usuario autenticado (por RLS). */
export async function getMyOrgTrial(): Promise<OrgTrial | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('trial_ends_at, data_deleted_at, delete_scheduled_at, created_at')
    .maybeSingle()
  return (data as OrgTrial | null) ?? null
}
