'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTag, deleteTag } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Input } from '@/shared/components/ui/field'

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
    <Section
      title="Etiquetas"
      description="Agrupa a tus clientes a tu manera: «Prefiere la tarde», «Paga en efectivo»…"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tags.length === 0 && <span className="text-[13.5px] text-ink-muted">Todavía no creas ninguna.</span>}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-1 text-[13px] font-semibold text-white"
            style={{ background: t.color }}
            data-testid="tag-chip"
          >
            {t.name}
            <button
              type="button"
              onClick={() => remove(t.id)}
              disabled={pending}
              className="grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/20 disabled:opacity-50"
              aria-label={`Eliminar ${t.name}`}
            >
              <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.6} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="relative grid h-11 w-11 flex-none cursor-pointer place-items-center overflow-hidden rounded-[13px] shadow-[inset_0_0_0_2px_#d6dbec] md:h-10 md:w-10" title="Color de la etiqueta">
          <span className="sr-only">Color de la etiqueta</span>
          <span className="h-6 w-6 rounded-full" style={{ background: color }} aria-hidden />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nombre de la etiqueta</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="tag-name"
            placeholder="Nueva etiqueta (ej. VIP)"
          />
        </label>
        <Button onClick={add} disabled={pending || !name.trim()} data-testid="add-tag">
          Crear
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-[#a51b18]" role="alert">{error}</p>}
    </Section>
  )
}
