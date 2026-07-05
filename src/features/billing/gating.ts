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
  ai_tier: string
  has_domain: boolean
  team_seats: number
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

const ACTIVE_STATES = new Set(['trialing', 'active'])

/** Lee la suscripción de la org del usuario autenticado (por RLS). */
export async function getMySubscription(): Promise<OrgSubscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select(
      'status, ai_tier, has_domain, team_seats, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id'
    )
    .maybeSingle()
  return (data as OrgSubscription | null) ?? null
}

/** ¿La suscripción da acceso vigente (trial o activa)? */
export function subIsActive(sub: OrgSubscription | null): boolean {
  return !!sub && ACTIVE_STATES.has(sub.status)
}

/** ¿Tiene el módulo Recepcionista IA contratado y vigente? */
export function subHasAi(sub: OrgSubscription | null): boolean {
  return subIsActive(sub) && !!sub && sub.ai_tier !== 'none'
}
