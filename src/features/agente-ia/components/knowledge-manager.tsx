'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKnowledge, deleteKnowledge } from '../actions'

type KbItem = { id: string; content: string; source: string | null }

export function KnowledgeManager({ items }: { items: KbItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await addKnowledge(content)
      if (res.ok) {
        setContent('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteKnowledge(id)
      router.refresh()
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-1 text-base font-semibold text-ink">Base de conocimiento</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Datos que el agente puede usar para responder: ubicación, políticas, promociones, FAQs…
      </p>

      <div className="mb-4 flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          data-testid="kb-content"
          placeholder="Ej: Estamos en Av. Reforma 123. Aceptamos tarjeta y efectivo."
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400"
        />
        <button
          onClick={add}
          disabled={pending || !content.trim()}
          data-testid="add-kb"
          className="self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      <ul className="divide-y divide-line-row">
        {items.length === 0 && (
          <li className="py-2 text-sm text-ink-faint">Aún no hay información cargada.</li>
        )}
        {items.map((k) => (
          <li key={k.id} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="text-ink-muted">{k.content}</span>
            <button
              onClick={() => remove(k.id)}
              disabled={pending}
              className="shrink-0 text-xs text-rose-600 hover:underline"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
