'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTag, deleteTag } from '../actions'

type Tag = { id: string; name: string; color: string }

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await createTag({ name, color })
      if (res.ok) {
        setName('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTag(id)
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">Etiquetas</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {tags.length === 0 && <span className="text-xs text-gray-400">Sin etiquetas aún.</span>}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ background: t.color }}
            data-testid="tag-chip"
          >
            {t.name}
            <button
              onClick={() => remove(t.id)}
              disabled={pending}
              className="ml-0.5 opacity-70 hover:opacity-100"
              aria-label={`Eliminar ${t.name}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-10 rounded border border-gray-300"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="tag-name"
          placeholder="Nueva etiqueta (ej. VIP)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          data-testid="add-tag"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Crear
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </section>
  )
}
