import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamManager } from '@/features/equipo/components/team-manager'
import { getMembers, getPendingInvitations, getSeats } from '@/features/equipo/services'
import { getResources } from '@/features/profesionales/services'
import { getMySubscription } from '@/features/billing/gating'
import { billingCurrency } from '@/features/billing/currency'
import { currencyCode, fmtAmount, seatPrice } from '@/features/billing/plans'
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

  const [members, invitations, seats, resources, sub, { data: orgId }] = await Promise.all([
    getMembers(supabase),
    getPendingInvitations(supabase),
    getSeats(supabase),
    getResources(supabase),
    getMySubscription(),
    supabase.rpc('get_my_org'),
  ])
  const { data: org } = orgId
    ? await supabase.from('organizations').select('country').eq('id', orgId).maybeSingle()
    : { data: null }
  // Precio del acceso extra en la moneda en que paga (o pagaría) el negocio.
  const currency = await billingCurrency({ country: org?.country, subscriptionCurrency: sub?.currency })
  const seatLabel = `${fmtAmount(seatPrice(currency))} ${currencyCode(currency)}/mes${currency === 'mxn' ? ' más IVA' : ''}`

  return (
    <Page>
      <PageHeader title="Equipo" subtitle="Invita a quien te ayuda a operar y decide qué puede ver cada quien." />

      <TeamManager
        members={members}
        invitations={invitations}
        seats={seats}
        resources={resources.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }))}
        myId={user.id}
        seatLabel={seatLabel}
      />
    </Page>
  )
}
