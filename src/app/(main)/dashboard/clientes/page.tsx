import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TagManager } from '@/features/crm/components/tag-manager'

export const dynamic = 'force-dynamic'

type Tag = { id: string; name: string; color: string }
type ClientRow = {
  id: string
  name: string | null
  phone: string | null
  created_at: string
  client_tags: { tag: Tag | null }[] | null
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('id, name, phone, created_at, client_tags(tag:tags(id, name, color))')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q && q.trim()) {
    const term = q.trim().replace(/[%,]/g, '')
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const [{ data: clients }, { data: tags }] = await Promise.all([
    query,
    supabase.from('tags').select('id, name, color').order('name'),
  ])

  // Excluye los contactos internos del sandbox "Prueba el Chat IA" (handle
  // sandbox:<userId>): son artefactos de prueba del dueño, no clientes reales.
  const rows = ((clients as ClientRow[] | null) ?? []).filter(
    (c) => !c.phone?.startsWith('sandbox:')
  )

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-xl font-bold text-ink">Clientes (CRM)</h1>

        <TagManager tags={(tags as Tag[] | null) ?? []} />

        <form className="flex gap-2" action="/dashboard/clientes" method="get">
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

        {rows.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
            {q ? (
              'Sin resultados.'
            ) : (
              <>
                <p className="font-medium text-ink-muted">Tu CRM se llena solo 👥</p>
                <p className="mt-1">
                  Cada cliente que escriba por chat, reserve en tu página web o agende una cita
                  queda registrado aquí, con su historial de citas y conversaciones.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id} className="rounded-card border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/clientes/${c.id}`}
                    className="font-medium text-ink hover:underline"
                    data-testid="client-link"
                  >
                    {c.name || c.phone || 'Cliente sin nombre'}
                  </Link>
                  {/* El teléfono a la derecha solo si ya hay nombre: sin nombre
                      el título YA es el teléfono y se veía repetido. */}
                  {c.name && <span className="text-xs text-ink-faint">{c.phone}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(c.client_tags ?? [])
                    .map((ct) => ct.tag)
                    .filter((t): t is Tag => t !== null)
                    .map((t) => (
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
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
