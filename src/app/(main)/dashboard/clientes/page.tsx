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

  const rows = (clients as ClientRow[] | null) ?? []

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-xl font-bold text-gray-900">Clientes (CRM)</h1>

        <TagManager tags={(tags as Tag[] | null) ?? []} />

        <form className="flex gap-2" action="/dashboard/clientes" method="get">
          <input
            name="q"
            defaultValue={q ?? ''}
            data-testid="client-search"
            placeholder="Buscar por nombre o teléfono…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Buscar
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
            {q ? 'Sin resultados.' : 'Aún no hay clientes. Aparecerán cuando alguien reserve o escriba.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/clientes/${c.id}`}
                    className="font-medium text-gray-900 hover:underline"
                    data-testid="client-link"
                  >
                    {c.name || c.phone || 'Cliente sin nombre'}
                  </Link>
                  <span className="text-xs text-gray-400">{c.phone}</span>
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
