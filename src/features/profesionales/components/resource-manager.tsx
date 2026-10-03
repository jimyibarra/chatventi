'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ServiceCatalog } from '@/features/agenda/types'
import { LINE_COLORS } from '@/features/lineas/model'
import { saveResource, saveResourceLabel } from '../actions'
import { RESOURCE_LABEL_PRESETS, toSingular, type ResourceView } from '../types'
import { ResourceCard } from './resource-card'
import { Inset, Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { Field, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

export function ResourceManager({
  orgId,
  resources,
  services,
  branchId,
  label,
}: {
  orgId: string
  resources: ResourceView[]
  services: ServiceCatalog[]
  branchId: string
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState(label)
  const [editingLabel, setEditingLabel] = useState(false)

  const singular = toSingular(label)

  // La misma numeración y color que en la Agenda y el Panel: el orden de los
  // activos (sort_order, nombre). Un inactivo no tiene línea.
  const lineOf = new Map(
    resources
      .filter((r) => r.active)
      .map((r, i) => [r.id, { n: i + 1, color: LINE_COLORS[i % LINE_COLORS.length] }] as const)
  )

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await saveResource({ name, branchId, active: true })
      if (res.ok) {
        setName('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function persistLabel(value: string) {
    setError(null)
    startTransition(async () => {
      const res = await saveResourceLabel({ label: value })
      if (res.ok) {
        setEditingLabel(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <Section
        title={`Añadir a ${label.toLowerCase()}`}
        description="Quién presta los servicios. No necesitan cuenta para estar en la agenda."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setEditingLabel((v) => !v)} aria-expanded={editingLabel}>
            <Icon name="tag" className="h-4 w-4" />
            Cambiar cómo los llamas
          </Button>
        }
      >
        {editingLabel && (
          <Inset className="mb-4">
            <Field as="div" label="Cómo llamas a quien presta tus servicios">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Cómo llamas a quien presta tus servicios"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  maxLength={40}
                  className="max-w-[18rem]"
                />
                <Button onClick={() => persistLabel(labelDraft)} disabled={pending || !labelDraft.trim()}>
                  Guardar
                </Button>
              </div>
            </Field>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {RESOURCE_LABEL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setLabelDraft(p.value)}
                  aria-pressed={labelDraft === p.value}
                  className={`min-h-[44px] rounded-full px-3.5 text-[13.5px] font-semibold transition-colors duration-150 md:min-h-[36px] ${
                    labelDraft === p.value ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_2px_#d6dbec] hover:bg-brand-50'
                  }`}
                  title={p.hint}
                >
                  {p.value}
                </button>
              ))}
            </div>
          </Inset>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nombre" className="min-w-[min(100%,16rem)] flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) add()
              }}
              data-testid="resource-name"
              placeholder="Ana García"
            />
          </Field>
          <Button onClick={add} disabled={pending || !name.trim()} data-testid="add-resource">
            <Icon name="plus" strokeWidth={2.6} />
            Añadir {singular.toLowerCase()}
          </Button>
        </div>

        {error && <p className="mt-2.5 text-sm text-[#a51b18]" role="alert">{error}</p>}
      </Section>

      {resources.length === 0 ? (
        <EmptyState icon="badge" title={`Aún no has añadido ${label.toLowerCase()}`}>
          Mientras no haya ninguno, las reservas no se asignan a nadie y una cita ocupa toda la
          sucursal. Cada uno que añadas será una línea de color en tu agenda.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              orgId={orgId}
              resource={r}
              services={services}
              branchId={branchId}
              singularLabel={singular}
              line={lineOf.get(r.id) ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
