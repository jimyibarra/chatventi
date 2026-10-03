'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateClient, tagClient, untagClient } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

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
    <Section title="Ficha" description="Lo que tu equipo debe saber antes de atenderle.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="client-name-input" />
        </Field>
        <Field label="Teléfono o usuario">
          <Input value={client.phone ?? ''} disabled className="tabular-nums" />
        </Field>
      </div>

      <Field label="Notas" className="mt-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          data-testid="client-notes"
          placeholder="Preferencias, alergias, observaciones…"
        />
      </Field>

      <div className="mt-4">
        <p className="mb-1.5 text-[13.5px] font-semibold text-ink">Etiquetas</p>
        {allTags.length === 0 ? (
          <p className="text-[13.5px] text-ink-muted">Crea etiquetas en la lista de clientes y aquí podrás asignarlas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => {
              const on = assigned.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  disabled={pending}
                  data-testid="tag-toggle"
                  aria-pressed={on}
                  className="inline-flex min-h-[44px] items-center md:min-h-[36px] gap-1.5 rounded-full border-2 px-3 text-[13.5px] font-semibold transition-colors duration-150 disabled:opacity-60"
                  style={on ? { background: t.color, color: '#fff', borderColor: t.color } : { borderColor: t.color, color: '#2a1a5e', background: '#fff' }}
                >
                  {on ? (
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <i className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} aria-hidden />
                  )}
                  {t.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending} data-testid="save-client">
          {pending ? 'Guardando…' : 'Guardar ficha'}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0b5d36]" role="status">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
            Guardado
          </span>
        )}
      </div>
    </Section>
  )
}
