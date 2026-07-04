'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateClient, tagClient, untagClient } from '../actions'

type Tag = { id: string; name: string; color: string }

export function ClientDetail({
  client,
  allTags,
  assignedTagIds,
}: {
  client: { id: string; name: string | null; phone: string | null; notes: string | null }
  allTags: Tag[]
  assignedTagIds: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(client.name ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [assigned, setAssigned] = useState<Set<string>>(new Set(assignedTagIds))
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(false)
    startTransition(async () => {
      const res = await updateClient({ clientId: client.id, name, notes })
      if (res.ok) {
        setSaved(true)
        router.refresh()
      }
    })
  }

  function toggleTag(tagId: string) {
    const has = assigned.has(tagId)
    // Optimista
    setAssigned((prev) => {
      const next = new Set(prev)
      if (has) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    startTransition(async () => {
      if (has) await untagClient(client.id, tagId)
      else await tagClient(client.id, tagId)
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="client-name-input"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono / handle</label>
          <input
            value={client.phone ?? ''}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          data-testid="client-notes"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Preferencias, alergias, observaciones…"
        />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Etiquetas</label>
        {allTags.length === 0 ? (
          <p className="text-xs text-gray-400">Crea etiquetas en la lista de clientes.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => {
              const on = assigned.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  disabled={pending}
                  data-testid="tag-toggle"
                  className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={
                    on
                      ? { background: t.color, color: '#fff', borderColor: t.color }
                      : { borderColor: '#d1d5db', color: '#6b7280' }
                  }
                >
                  {on ? '✓ ' : ''}
                  {t.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          data-testid="save-client"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-sm text-emerald-700">Guardado ✓</span>}
      </div>
    </section>
  )
}
