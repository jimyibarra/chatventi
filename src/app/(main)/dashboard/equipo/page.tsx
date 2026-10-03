import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamManager } from '@/features/equipo/components/team-manager'
import { getMembers, getPendingInvitations, getSeats } from '@/features/equipo/services'
import { getResources } from '@/features/profesionales/services'
import { Page, PageHeader } from '@/shared/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Gestionar el equipo es del dueño. El proxy ya lo bloquea; esto es la
  // segunda barrera (defensa en profundidad: la RPC es la tercera y la real).
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'owner') redirect('/dashboard')

  const [members, invitations, seats, resources] = await Promise.all([
    getMembers(supabase),
    getPendingInvitations(supabase),
    getSeats(supabase),
    getResources(supabase),
  ])

  return (
    <Page>
      <PageHeader title="Equipo" subtitle="Invita a quien te ayuda a operar y decide qué puede ver cada quien." />

      <TeamManager
        members={members}
        invitations={invitations}
        seats={seats}
        resources={resources.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }))}
        myId={user.id}
      />
    </Page>
  )
}
