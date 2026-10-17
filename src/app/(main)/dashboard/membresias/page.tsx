import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PlansManager } from '@/features/membresias/components/plans-manager'
import { STATE_TONE, fmtDay, type PlanOption } from '@/features/membresias/view'
import { STATE_LABEL, daysBetween, membershipState, todayMx, addDays, type MembershipState } from '@/features/membresias/logic'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { StatusChip } from '@/shared/components/ui/status-chip'
import { fmtInt } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

// Membresías (fase 4, 17-oct-2026): el tablero del gimnasio. Primero lo que
// pide acción (por vencer y vencidas), luego las vigentes.

type Row = {
  id: string
  plan_name: string
  starts_on: string
  ends_on: string
  client: { id: string; name: string | null; phone: string | null } | null
}

const GROUPS: { states: MembershipState[]; title: string; empty: string }[] = [
  { states: ['expiring'], title: 'Por vencer (7 días)', empty: 'Nadie vence esta semana.' },
  { states: ['expired'], title: 'Vencidas (últimos 30 días)', empty: 'Ninguna vencida en el último mes.' },
  { states: ['active', 'future'], title: 'Vigentes', empty: 'Sin membresías vigentes.' },
]

export default async function MembresiasPage() {
  const supabase = await createClient()
  const today = todayMx()
  const [{ data: plans }, { data: rows }, { data: { user } }] = await Promise.all([
    supabase.from('membership_plans').select('id, name, duration_days, price').eq('active', true).order('duration_days'),
    supabase
      .from('memberships')
      .select('id, plan_name, starts_on, ends_on, client:clients(id, name, phone)')
      .is('cancelled_at', null)
      .gte('ends_on', addDays(today, -30))
      .order('ends_on')
      .limit(500),
    supabase.auth.getUser(),
  ])
  const { data: me } = user ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() : { data: null }
  const canEdit = me?.role === 'owner' || me?.role === 'manager'

  // Una sola fila por cliente: la de vencimiento más lejano (la renovación manda).
  const byClient = new Map<string, Row>()
  for (const r of (rows ?? []) as unknown as Row[]) {
    const k = r.client?.id ?? r.id
    const prev = byClient.get(k)
    if (!prev || r.ends_on > prev.ends_on) byClient.set(k, r)
  }
  const list = [...byClient.values()].map((r) => ({ ...r, state: membershipState({ starts_on: r.starts_on, ends_on: r.ends_on, cancelled: false }, today) }))

  return (
    <Page>
      <PageHeader title="Membresías" subtitle="Quién está al corriente, quién vence esta semana y a quién hay que invitar a volver." />
      <div className="mb-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <StatusChip key={g.title} tone={STATE_TONE[g.states[0]]} size="md">
            {g.title}: {fmtInt(list.filter((r) => g.states.includes(r.state)).length)}
          </StatusChip>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {GROUPS.map((g) => {
            const items = list.filter((r) => g.states.includes(r.state))
            return (
              <Section key={g.title} title={g.title}>
                {items.length === 0 ? (
                  <p className="text-[14.5px] text-ink-muted">{g.empty}</p>
                ) : (
                  <ul className="divide-y divide-line" data-testid="memberships-list">
                    {items.map((r) => {
                      const left = daysBetween(today, r.ends_on)
                      return (
                        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[14.5px]">
                          {r.client ? (
                            <Link href={`/dashboard/clientes/${r.client.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                              {r.client.name || r.client.phone || 'Cliente'}
                            </Link>
                          ) : (
                            <span className="font-semibold text-ink">Cliente</span>
                          )}
                          <span className="text-ink-muted">{r.plan_name}</span>
                          <StatusChip tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</StatusChip>
                          <span className="ml-auto tabular-nums text-ink-muted">
                            {r.state === 'expired' ? `venció el ${fmtDay(r.ends_on)}` : left === 0 ? 'vence hoy' : `vence el ${fmtDay(r.ends_on)} (${left} días)`}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            )
          })}
        </div>
        <div className="min-w-0">
          <PlansManager plans={(plans ?? []) as PlanOption[]} canEdit={canEdit} />
        </div>
      </div>
    </Page>
  )
}
