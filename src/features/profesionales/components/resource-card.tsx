'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WEEKDAYS, type ServiceCatalog } from '@/features/agenda/types'
import {
  saveResource,
  deactivateResource,
  reactivateResource,
  setResourceServices,
  addResourceSchedule,
  deleteResourceSchedule,
} from '../actions'
import type { ResourceView } from '../types'

export function ResourceCard({
  resource,
  services,
  branchId,
  singularLabel,
}: {
  resource: ResourceView
  services: ServiceCatalog[]
  branchId: string
  singularLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(resource.name)
  const [photoUrl, setPhotoUrl] = useState(resource.photo_url ?? '')
  const [picked, setPicked] = useState<string[]>(resource.serviceIds)

  const [weekday, setWeekday] = useState('1')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  const allServices = picked.length === 0

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Ocurrió un error.')
    })
  }

  function toggleService(id: string) {
    const next = picked.includes(id) ? picked.filter((s) => s !== id) : [...picked, id]
    setPicked(next)
    run(() => setResourceServices({ resourceId: resource.id, serviceIds: next }))
  }

  return (
    <li className="rounded-card border border-line bg-white">
      <div className="flex items-center gap-3 p-4">
        {resource.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.photo_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
            aria-hidden
          >
            {resource.name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium ${
              resource.active ? 'text-ink' : 'text-ink-faint line-through'
            }`}
          >
            {resource.name}
            {!resource.active && ' (inactivo)'}
          </p>
          <p className="text-xs text-ink-soft">
            {allServices ? 'Todos los servicios' : `${picked.length} servicio(s)`} ·{' '}
            {resource.schedules.length === 0
              ? 'Sin horario'
              : `${resource.schedules.length} bloque(s) de horario`}
            {resource.profile_id && ' · con cuenta'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid={`resource-toggle-${resource.id}`}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface"
          aria-expanded={open}
        >
          {open ? 'Cerrar' : 'Configurar'}
        </button>
      </div>

      {open && (
        <div className="space-y-5 border-t border-line-soft p-4">
          {error && <p className="text-sm text-rose-700">{error}</p>}

          {/* Datos */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Datos
            </h3>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                />
              </div>
              <div className="min-w-[16rem] flex-1">
                <label className="mb-1 block text-xs text-ink-soft">Foto (URL)</label>
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-line px-3 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={() =>
                  run(() =>
                    saveResource({ id: resource.id, name, photoUrl, branchId, active: resource.active })
                  )
                }
                disabled={pending || !name.trim()}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>

          {/* Servicios */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Servicios que presta
            </h3>
            {services.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Aún no hay servicios en el catálogo.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                        picked.includes(s.id)
                          ? 'border-brand-200 bg-brand-50 text-brand-800'
                          : 'border-line text-ink-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={picked.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                        disabled={pending}
                        className="h-3.5 w-3.5"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
                {allServices && (
                  <p className="mt-2 text-xs text-ink-soft">
                    Sin ninguno marcado, {resource.name} se ofrece para{' '}
                    <strong>todos los servicios</strong>. Marca los suyos para limitarlo.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Horario */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Horario propio
            </h3>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Día</label>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Desde</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Hasta</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={() =>
                  run(() =>
                    addResourceSchedule({
                      branchId,
                      resourceId: resource.id,
                      weekday,
                      startTime,
                      endTime,
                    })
                  )
                }
                disabled={pending}
                data-testid={`add-schedule-${resource.id}`}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>

            <ul className="divide-y divide-line-row">
              {resource.schedules.length === 0 && (
                <li className="py-2 text-sm text-ink-faint">
                  Sin horario: no aparecerá en los huecos disponibles.
                </li>
              )}
              {resource.schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-muted">
                    {WEEKDAYS[s.weekday]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                  <button
                    onClick={() => run(() => deleteResourceSchedule(s.id))}
                    disabled={pending}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Estado */}
          <div className="border-t border-line-soft pt-3">
            {resource.active ? (
              <button
                onClick={() => run(() => deactivateResource(resource.id))}
                disabled={pending}
                className="text-xs text-rose-600 hover:underline"
              >
                Desactivar {singularLabel.toLowerCase()}
              </button>
            ) : (
              <button
                onClick={() => run(() => reactivateResource(resource.id))}
                disabled={pending}
                className="text-xs text-brand-600 hover:underline"
              >
                Reactivar
              </button>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              Desactivar no borra su historial de citas: deja de ofrecerse para nuevas reservas.
            </p>
          </div>
        </div>
      )}
    </li>
  )
}
