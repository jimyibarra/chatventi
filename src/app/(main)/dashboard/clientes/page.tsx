import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TagManager } from '@/features/crm/components/tag-manager'
import { ClientImport } from '@/features/crm/components/client-import'
import {
  SEGMENT_META,
  type CrmClient,
  type CrmStats,
  type Segment,
} from '@/features/crm/segments'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Card } from '@/shared/components/ui/card'
import { buttonClass } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { Notice } from '@/shared/components/ui/notice'
import { Avatar } from '@/shared/components/ui/avatar'
import { Icon } from '@/shared/components/ui/icon'
import { CONTROL, CONTROL_H } from '@/shared/components/ui/field'
import { SEGMENT_SCROLL, SegmentLink } from '@/shared/components/ui/segmented'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { fmtInt, fmtMoney } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

type Tag = { id: string; name: string; color: string }
type Filter = Segment | 'inactive' | null

// Segmento → chip. VIP en violeta de marca; el resto, neutro: un segmento no
// pide acción (el amarillo queda para lo que sí la pide).
const SEGMENT_TONE: Record<Segment, ChipTone> = { vip: 'brand', regular: 'neutral', nuevo: 'neutral' }

function lastVisitLabel(iso: string | null): string {
  if (!iso) return 'Sin visitas'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  if (days < 60) return `Hace ${Math.floor(days / 7)} sem`
  return `Hace ${Math.floor(days / 30)} meses`
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seg?: string }>
}) {
  const { q, seg } = await searchParams
  const supabase = await createClient()

  const [{ data: overview }, { data: tags }] = await Promise.all([
    supabase.rpc('get_crm_overview'),
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  const parsed = (overview as unknown as { stats: CrmStats; clients: CrmClient[] } | null) ?? {
    stats: { total: 0, nuevo: 0, regular: 0, vip: 0, inactive: 0 },
    clients: [],
  }
  const stats = parsed.stats
  const allClients = parsed.clients

  const filter: Filter =
    seg === 'nuevo' || seg === 'regular' || seg === 'vip' || seg === 'inactive' ? seg : null
  const term = (q ?? '').trim().toLowerCase()

  const rows = allClients.filter((c) => {
    if (filter === 'inactive' ? !c.inactive : filter && c.segment !== filter) return false
    if (term) {
      const hay = `${c.name ?? ''} ${c.phone ?? ''}`.toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })

  const segHref = (s: Filter) => {
    const p = new URLSearchParams()
    if (term) p.set('q', q as string)
    if (s) p.set('seg', s)
    const qs = p.toString()
    return `/dashboard/clientes${qs ? `?${qs}` : ''}`
  }

  const exportHref = `/dashboard/clientes/export${filter ? `?seg=${filter}` : ''}`

  return (
    <Page width="wide">
      <PageHeader
        title="Clientes"
        subtitle={
          stats.total > 0
            ? `${fmtInt(stats.total)} en tu CRM. Se suman solos cuando te escriben, reservan o agendas una cita.`
            : 'Tu CRM se llena solo: cada cliente que te escribe o reserva queda aquí.'
        }
        actions={
          <>
            <a href={exportHref} data-testid="crm-export" className={buttonClass('secondary')}>
              <Icon name="download" />
              Exportar CSV
            </a>
            <ClientImport />
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* Filtros: el segmento va en la URL, así el enlace se puede compartir. */}
          <div className="flex flex-wrap items-center gap-3">
            <nav className={SEGMENT_SCROLL} aria-label="Filtrar clientes por segmento">
              <SegmentLink href={segHref(null)} active={filter === null} count={stats.total}>
                Todos
              </SegmentLink>
              <SegmentLink href={segHref('nuevo')} active={filter === 'nuevo'} count={stats.nuevo}>
                Nuevos
              </SegmentLink>
              <SegmentLink href={segHref('regular')} active={filter === 'regular'} count={stats.regular}>
                Regulares
              </SegmentLink>
              <SegmentLink href={segHref('vip')} active={filter === 'vip'} count={stats.vip}>
                VIP
              </SegmentLink>
              <SegmentLink href={segHref('inactive')} active={filter === 'inactive'} count={stats.inactive}>
                Inactivos
              </SegmentLink>
            </nav>

            <form className="flex min-w-[min(100%,18rem)] flex-1 gap-2" action="/dashboard/clientes" method="get" role="search">
              {filter && <input type="hidden" name="seg" value={filter} />}
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar por nombre o teléfono</span>
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" />
                <input
                  name="q"
                  type="search"
                  defaultValue={q ?? ''}
                  data-testid="client-search"
                  placeholder="Buscar por nombre o teléfono…"
                  className={`${CONTROL} ${CONTROL_H} w-full pl-10`}
                />
              </label>
              <button type="submit" className={buttonClass('secondary')}>
                Buscar
              </button>
            </form>
          </div>

          {filter === 'inactive' && rows.length > 0 && (
            <Notice tone="info" title="Llevan más de 60 días sin venir">
              Buen momento para escribirles y reactivarlos.
            </Notice>
          )}

          {rows.length === 0 ? (
            q || filter ? (
              <EmptyState
                icon="search"
                title="Nadie coincide con este filtro"
                action={
                  <Link href="/dashboard/clientes" className={buttonClass('secondary')}>
                    Ver todos los clientes
                  </Link>
                }
              >
                Prueba con otra parte del nombre o con los últimos dígitos del teléfono.
              </EmptyState>
            ) : (
              <EmptyState icon="users" title="Tu CRM se llena solo">
                Cada cliente que escriba por chat, reserve en tu página web o agende una cita queda
                registrado aquí, con su segmento, historial y expediente. Si ya tienes una lista,
                impórtala en CSV.
              </EmptyState>
            )
          ) : (
            <Card padded={false} className="px-4 py-1 md:px-5">
              <ul className="divide-y divide-line">
                {rows.map((c) => {
                  const meta = SEGMENT_META[c.segment]
                  const name = c.name || c.phone || 'Cliente sin nombre'
                  return (
                    <li key={c.id} className="group relative flex items-center gap-3 py-3.5">
                      <Avatar name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="min-w-0 rounded-[6px] text-[15px] font-semibold text-ink [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] group-hover:underline"
                            data-testid="client-link"
                          >
                            {name}
                          </Link>
                          <StatusChip tone={SEGMENT_TONE[c.segment]}>{meta.label}</StatusChip>
                          {c.inactive && <StatusChip tone="off">Inactivo</StatusChip>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-muted">
                          {c.name && c.phone && <span className="tabular-nums">{c.phone}</span>}
                          <span>
                            {fmtInt(c.appt_count)} {c.appt_count === 1 ? 'cita' : 'citas'}
                          </span>
                          <span>{lastVisitLabel(c.last_visit)}</span>
                          {c.spent > 0 && <span className="tabular-nums">{fmtMoney(c.spent)} registrado</span>}
                          {(c.tags ?? []).map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex h-[21px] items-center rounded-full px-2 text-[11.5px] font-semibold text-white"
                              style={{ background: t.color }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Icon name="chevronRight" className="h-5 w-5 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="min-w-0">
          <TagManager tags={(tags as Tag[] | null) ?? []} />
        </aside>
      </div>
    </Page>
  )
}
