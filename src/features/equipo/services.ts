import { createClient } from '@/lib/supabase/server'
import { isBillingEnforced } from '@/features/billing/gating'
import type { Member, Seats, TeamInvitation } from './types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

// Miembros del equipo (profiles con cuenta). El super_admin es de ChatVenti,
// no del tenant: nunca aparece aquí ni consume asiento.
export async function getMembers(supabase: ServerClient): Promise<Member[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, resource_scope, is_active, created_at, resources(id, name)')
    .neq('role', 'super_admin')
    .order('created_at')

  type Row = Omit<Member, 'resourceId' | 'resourceName'> & {
    resources: { id: string; name: string }[] | null
  }

  return ((data as Row[] | null) ?? []).map((row) => {
    const resource = row.resources?.[0] ?? null
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      resource_scope: row.resource_scope,
      is_active: row.is_active,
      created_at: row.created_at,
      resourceId: resource?.id ?? null,
      resourceName: resource?.name ?? null,
    }
  })
}

// Invitaciones pendientes (RLS: solo el owner de la org las ve).
export async function getPendingInvitations(supabase: ServerClient): Promise<TeamInvitation[]> {
  const { data } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  return (data ?? []) as TeamInvitation[]
}

// "X de N accesos en uso". El plan base incluye al dueño; team_seats son
// accesos ADICIONALES ($19/mes cada uno).
export async function getSeats(supabase: ServerClient): Promise<Seats> {
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { used: 0, allowed: 1, enforced: isBillingEnforced() }

  const [{ data: used }, { data: sub }] = await Promise.all([
    supabase.rpc('org_seats_used', { p_org: orgId }),
    supabase.from('subscriptions').select('team_seats').maybeSingle(),
  ])

  return {
    used: used ?? 0,
    allowed: 1 + (sub?.team_seats ?? 0),
    enforced: isBillingEnforced(),
  }
}
