import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  ADDON_DOMAIN_USD,
  monthlyTotal,
  periodPrice,
  planById,
  planFromLegacyTier,
  type Currency,
  type PlanId,
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

/** «Aclarar este pago» de los negocios: abiertas y resueltas en los últimos 30 días. */
export type BillingInquiry = {
  id: string
  organization: string
  contact_email: string | null
  invoice_number: string | null
  stripe_invoice_id: string
  amount: number | null
  currency: string | null
  reason: 'duplicado' | 'no_reconozco' | 'monto' | 'otro'
  message: string
  status: 'open' | 'resolved'
  created_at: string
}

export async function getBillingInquiries(): Promise<BillingInquiry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_billing_inquiries')
  if (error) throw error
  return (data ?? []) as unknown as BillingInquiry[]
}

/** Plan, periodicidad y moneda REALES de cada negocio (admin_org_billing). */
export type OrgBilling = {
  plan_id: string | null
  billing_interval: string | null
  currency: string | null
  status: string
  stripe: boolean
}

export async function getOrgBilling(): Promise<Map<string, OrgBilling>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_org_billing')
  if (error) throw error
  const rows = (data ?? []) as unknown as (OrgBilling & { organization_id: string })[]
  return new Map(rows.map((r) => [r.organization_id, r]))
}

/**
 * ¿Le entra dinero a ChatVenti por este negocio? Sí si paga con Stripe o si
 * lo factura un socio EXTERNO. No si es de un socio interno (PASEN) ni si es
 * una cuenta propia sin cobro (la demo, «ChatVenti Ventas»).
 */
export function paysChatVenti(billing: OrgBilling | undefined, origin: PartnerOrigin | undefined): boolean {
  return Boolean(billing?.stripe) || origin?.internal === false
}

/** Plan del negocio: el del catálogo actual; si no tiene, el equivalente del legado. */
export function orgPlanId(org: Pick<AdminOrg, 'ai_tier'>, billing?: OrgBilling): PlanId {
  return billing?.plan_id ? (billing.plan_id as PlanId) : planFromLegacyTier(org.ai_tier)
}

/**
 * Lo que paga al mes, en SU moneda y SIN IVA (el IVA no es ingreso). El anual
 * se reparte entre 12. Los negocios de un socio externo se valúan a precio de
 * lista (se les factura con su descuento: es una aproximación por arriba).
 */
export function orgMonthly(
  org: Pick<AdminOrg, 'ai_tier' | 'has_domain' | 'team_seats'>,
  billing?: OrgBilling
): { amount: number; currency: Currency } {
  const currency: Currency = billing?.currency === 'mxn' ? 'mxn' : 'usd'
  const plan = orgPlanId(org, billing)
  const base =
    monthlyTotal({ plan, extraSeats: org.team_seats, currency }) +
    (currency === 'usd' && org.has_domain && !planById(plan).includesDomain ? ADDON_DOMAIN_USD : 0)
  const monthly = billing?.billing_interval === 'year' ? periodPrice(base, 'year') / 12 : base
  return { amount: Math.round(monthly * 100) / 100, currency }
}

/**
 * MRR separado por moneda (sin convertir: cada cifra es exacta). Los negocios
 * de un socio interno (PASEN) no cuentan: ese ingreso es de la otra
 * plataforma, que es quien le cobra al cliente.
 */
export function computeMrr(
  orgs: AdminOrg[],
  billing: Map<string, OrgBilling>,
  origins: Map<string, PartnerOrigin>
): { usd: number; mxn: number } {
  const out = { usd: 0, mxn: 0 }
  for (const o of orgs) {
    if (o.sub_status !== 'active' || !paysChatVenti(billing.get(o.id), origins.get(o.id))) continue
    const m = orgMonthly(o, billing.get(o.id))
    out[m.currency] += m.amount
  }
  return { usd: Math.round(out.usd * 100) / 100, mxn: Math.round(out.mxn * 100) / 100 }
}

/** Negocio que llegó por un socio: nombre del socio y si es interno (Grupo ELRI). */
export type PartnerOrigin = { name: string; internal: boolean }

export async function getPartnerOrigins(): Promise<Map<string, PartnerOrigin>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_partner_orgs')
  if (error) throw error
  const rows = (data ?? []) as unknown as { organization_id: string; partner_name: string; partner_kind: string }[]
  return new Map(rows.map((r) => [r.organization_id, { name: r.partner_name, internal: r.partner_kind === 'internal' }]))
}

/** Ids de los negocios incluidos en el paquete de un socio interno. */
export function internalOrgIds(origins: Map<string, PartnerOrigin>): Set<string> {
  return new Set([...origins].filter(([, o]) => o.internal).map(([id]) => id))
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
