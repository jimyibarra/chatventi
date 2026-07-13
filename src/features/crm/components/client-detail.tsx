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
    <section className="rounded-card border border-line bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="client-name-input"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Teléfono / handle</label>
          <input
            value={client.phone ?? ''}
            disabled
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-soft"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-ink-muted">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          data-testid="client-notes"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="Preferencias, alergias, observaciones…"
        />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-ink-muted">Etiquetas</label>
        {allTags.length === 0 ? (
          <p className="text-xs text-ink-faint">Crea etiquetas en la lista de clientes.</p>
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
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-sm text-success">Guardado ✓</span>}
      </div>
    </section>
  )
}
