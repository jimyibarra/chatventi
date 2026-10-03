'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKnowledge, deleteKnowledge } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip } from '@/shared/components/ui/status-chip'

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
    <Section
      title="Base de conocimiento"
      badge={items.length > 0 ? <StatusChip>{items.length}</StatusChip> : undefined}
      description="Datos que el agente puede usar para responder: ubicación, políticas, promociones, preguntas frecuentes…"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nuevo dato para la recepcionista</span>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            data-testid="kb-content"
            placeholder="Ej: Estamos en Av. Reforma 123. Aceptamos tarjeta y efectivo."
          />
        </label>
        <Button onClick={add} disabled={pending || !content.trim()} data-testid="add-kb">
          <Icon name="plus" strokeWidth={2.6} />
          Agregar
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-[#a51b18]" role="alert">{error}</p>}

      <ul className="divide-y divide-line">
        {items.length === 0 && (
          <li className="rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted">
            Aún no hay información cargada. Empieza por tu dirección, tus formas de pago y tu política de cancelación.
          </li>
        )}
        {items.map((k) => (
          <li key={k.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <Icon name="book" className="mt-0.5 h-[18px] w-[18px] text-brand-500" />
            <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink [overflow-wrap:anywhere]">{k.content}</span>
            <Button variant="danger" size="sm" onClick={() => remove(k.id)} disabled={pending} aria-label="Eliminar este dato">
              <Icon name="trash" className="h-4 w-4" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  )
}
