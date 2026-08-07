import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  ADDON_DOMAIN_USD,
  ADDON_SEAT_USD,
  planById,
  planFromLegacyTier,
} from '@/features/billing/plans'

// Estadísticas globales de la plataforma (una fila, calculada en Postgres).
export interface AdminGlobalStats {
  orgs_total: number
  users_total: number
  new_orgs_7d: number
  new_orgs_30d: number
  subs_active: number
  subs_trialing: number
  subs_past_due: number
  subs_canceled: number
  conversations_total: number
  messages_total: number
  appointments_total: number
  clients_total: number
  msgs_7d: number
  appts_7d: number
}

// Una organización con su dueño, plan y actividad (RPC admin_list_organizations).
export interface AdminOrg {
  id: string
  name: string
  country: string | null
  city: string | null
  created_at: string
  owner_email: string | null
  owner_name: string | null
  plan: string
  sub_status: string
  ai_tier: string
  has_domain: boolean
  team_seats: number
  trial_end: string | null
  current_period_end: string | null
  users_count: number
  conversations_count: number
  appointments_count: number
  clients_count: number
  last_activity: string | null
}

/**
 * Precio mensual (USD) según el catálogo 2026-08. La RPC admin_list_organizations
 * todavía expone ai_tier (legado): se traduce al plan equivalente. Cuando la RPC
 * devuelva plan_id directamente (fase contract), usarlo aquí.
 */
export function orgMonthlyUsd(org: Pick<AdminOrg, 'ai_tier' | 'has_domain' | 'team_seats'>): number {
  const plan = planById(planFromLegacyTier(org.ai_tier))
  return (
    plan.priceUsd +
    (org.has_domain && !plan.includesDomain ? ADDON_DOMAIN_USD : 0) +
    org.team_seats * ADDON_SEAT_USD
  )
}

/** MRR = suma del valor mensual de las suscripciones activas (paga confirmada). */
export function computeMrrUsd(orgs: AdminOrg[]): number {
  return orgs
    .filter((o) => o.sub_status === 'active')
    .reduce((sum, o) => sum + orgMonthlyUsd(o), 0)
}

export async function getAdminGlobalStats(): Promise<AdminGlobalStats> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_global_stats')
  if (error) throw error
  return data as unknown as AdminGlobalStats
}

export async function getAdminOrganizations(): Promise<AdminOrg[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_organizations')
  if (error) throw error
  return (data ?? []) as AdminOrg[]
}
