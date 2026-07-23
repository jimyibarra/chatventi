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

export const dynamic = 'force-dynamic'

type Tag = { id: string; name: string; color: string }
type Filter = Segment | 'inactive' | null

function lastVisitLabel(iso: string | null): string {
  if (!iso) return 'Sin visitas'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  if (days < 60) return `Hace ${Math.floor(days / 7)} sem`
  return `Hace ${Math.floor(days / 30)} meses`
}

// Tarjeta-contador que además filtra el listado (clic → ?seg=...).
function StatCard({
  label,
  value,
  href,
  active,
  accent,
}: {
  label: string
  value: number
  href: string
  active: boolean
  accent?: string
}) {
  return (
    <Link
      href={href}
      className={`rounded-card border bg-white px-4 py-3 text-center transition hover:border-brand-300 ${
        active ? 'border-brand-400 ring-1 ring-brand-200' : 'border-line'
      }`}
    >
      <p className={`text-2xl font-bold ${accent ?? 'text-ink'}`}>{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </Link>
  )
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
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Clientes (CRM)</h1>
        <div className="flex gap-2">
          <a
            href={exportHref}
            data-testid="crm-export"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface"
          >
            ⬇ Exportar CSV
          </a>
          <ClientImport />
        </div>
      </div>

      {/* Panel de segmentación: cada tarjeta filtra el listado */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Todos" value={stats.total} href={segHref(null)} active={filter === null} />
        <StatCard
          label="Nuevos"
          value={stats.nuevo}
          href={segHref('nuevo')}
          active={filter === 'nuevo'}
        />
        <StatCard
          label="Regulares"
          value={stats.regular}
          href={segHref('regular')}
          active={filter === 'regular'}
        />
        <StatCard
          label="VIP"
          value={stats.vip}
          href={segHref('vip')}
          active={filter === 'vip'}
          accent="text-amber-600"
        />
        <StatCard
          label="Inactivos"
          value={stats.inactive}
          href={segHref('inactive')}
          active={filter === 'inactive'}
          accent="text-rose-600"
        />
      </div>

      <TagManager tags={(tags as Tag[] | null) ?? []} />

      <form className="flex gap-2" action="/dashboard/clientes" method="get">
        {filter && <input type="hidden" name="seg" value={filter} />}
        <input
          name="q"
          defaultValue={q ?? ''}
          data-testid="client-search"
          placeholder="Buscar por nombre o teléfono…"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
          Buscar
        </button>
      </form>

      {filter === 'inactive' && rows.length > 0 && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Estos clientes no vienen hace más de 60 días. Buen momento para escribirles y reactivarlos.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
          {q || filter ? (
            'Sin resultados con este filtro.'
          ) : (
            <>
              <p className="font-medium text-ink-muted">Tu CRM se llena solo 👥</p>
              <p className="mt-1">
                Cada cliente que escriba por chat, reserve en tu página web o agende una cita queda
                registrado aquí, con su segmento, historial y expediente.
              </p>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const meta = SEGMENT_META[c.segment]
            return (
              <li key={c.id} className="rounded-card border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/clientes/${c.id}`}
                      className="font-medium text-ink hover:underline"
                      data-testid="client-link"
                    >
                      {c.name || c.phone || 'Cliente sin nombre'}
                    </Link>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    {c.inactive && (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  {c.name && <span className="text-xs text-ink-faint">{c.phone}</span>}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                  <span>
                    {c.appt_count} {c.appt_count === 1 ? 'cita' : 'citas'}
                  </span>
                  <span>· {lastVisitLabel(c.last_visit)}</span>
                  {c.spent > 0 && <span>· ${c.spent} registrado</span>}
                  {(c.tags ?? []).map((t) => (
                    <span
                      key={t.id}
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ background: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
