'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ServiceCatalog } from '@/features/agenda/types'
import { saveResource, saveResourceLabel } from '../actions'
import { RESOURCE_LABEL_PRESETS, toSingular, type ResourceView } from '../types'
import { ResourceCard } from './resource-card'

export function ResourceManager({
  resources,
  services,
  branchId,
  label,
}: {
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
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">{label}</h2>
          <p className="text-sm text-ink-soft">
            Quién presta los servicios. No necesitan cuenta para estar en la agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingLabel((v) => !v)}
          className="text-xs text-brand-600 hover:underline"
        >
          Cambiar etiqueta
        </button>
      </div>

      {editingLabel && (
        <div className="mb-4 rounded-lg border border-line-soft bg-surface p-3">
          <label className="mb-1 block text-xs text-ink-soft">
            Cómo llamas a quien presta tus servicios
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm"
              maxLength={40}
            />
            <button
              onClick={() => persistLabel(labelDraft)}
              disabled={pending || !labelDraft.trim()}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RESOURCE_LABEL_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setLabelDraft(p.value)}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted hover:bg-white"
                title={p.hint}
              >
                {p.value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1 block text-xs text-ink-soft">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) add()
            }}
            data-testid="resource-name"
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm"
            placeholder={`Ana García`}
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          data-testid="add-resource"
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          Añadir {singular.toLowerCase()}
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      {resources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-sm text-ink-muted">
            Aún no has añadido {label.toLowerCase()}.
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Mientras no haya ninguno, las reservas no se asignan a nadie y una cita ocupa toda la
            sucursal.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              services={services}
              branchId={branchId}
              singularLabel={singular}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
