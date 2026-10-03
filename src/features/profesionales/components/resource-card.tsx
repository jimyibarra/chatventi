'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/shared/components/image-upload'
import { WEEKDAYS, type ServiceCatalog } from '@/features/agenda/types'
import {
  saveResource,
  deactivateResource,
  reactivateResource,
  setResourceServices,
  setResourcePhoto,
  addResourceSchedule,
  deleteResourceSchedule,
} from '../actions'
import type { ResourceView } from '../types'
import { Card, SubHeading } from '@/shared/components/ui/card'
import { Avatar } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { CHECKBOX, Field, Input, Select } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip } from '@/shared/components/ui/status-chip'

const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
// La semana empieza en lunes, como la piensa un negocio.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Siete estaciones, una por día: rellena si trabaja ese día, hueca si no. */
function WeekStrip({ days, color }: { days: Set<number>; color: string }) {
  const worked = WEEK_ORDER.filter((d) => days.has(d)).map((d) => WEEKDAYS[d].toLowerCase())
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={worked.length ? `Trabaja ${worked.join(', ')}` : 'Sin horario'}
    >
      {WEEK_ORDER.map((d) => {
        const on = days.has(d)
        return (
          <span
            key={d}
            className="grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[10.5px] font-bold leading-none"
            style={on ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#d6dbec', color: '#7d7996' }}
            aria-hidden
          >
            {DAY_LETTER[d]}
          </span>
        )
      })}
    </span>
  )
}

export function ResourceCard({
  orgId,
  resource,
  services,
  branchId,
  singularLabel,
  line,
}: {
  orgId: string
  resource: ResourceView
  services: ServiceCatalog[]
  branchId: string
  singularLabel: string
  /** Su línea en la Agenda (número y color). null si está inactivo. */
  line: { n: number; color: string } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(resource.name)
  const [picked, setPicked] = useState<string[]>(resource.serviceIds)

  const [weekday, setWeekday] = useState('1')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')

  const allServices = picked.length === 0
  const color = line?.color ?? '#a9a5bf'
  const workDays = new Set(resource.schedules.map((s) => s.weekday))

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
    <Card as="li" padded={false} className={resource.active ? '' : 'opacity-80'}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 p-4 md:px-5">
        <Avatar name={resource.name} src={resource.photo_url} color={color} />

        <div className="min-w-0 flex-1 basis-[12rem]">
          <p className={`flex flex-wrap items-center gap-2 text-[16px] font-semibold ${resource.active ? 'text-ink' : 'text-ink-muted line-through'}`}>
            {line && (
              <b
                className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[12px] font-bold text-white"
                style={{ background: line.color }}
                title={`Línea ${line.n} en la agenda`}
              >
                {line.n}
              </b>
            )}
            <span className="min-w-0 [overflow-wrap:anywhere]">{resource.name}</span>
            {!resource.active && <StatusChip tone="off">Inactivo</StatusChip>}
            {resource.profile_id && <StatusChip tone="neutral" icon={<Icon name="user" className="h-3 w-3" strokeWidth={2.4} />}>Con cuenta</StatusChip>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-muted">
            <WeekStrip days={workDays} color={color} />
            {resource.schedules.length === 0 ? (
              // Sin horario no aparece en los huecos: pide acción (amarillo) solo si está activo.
              resource.active ? <StatusChip tone="wait">Sin horario</StatusChip> : <span>Sin horario</span>
            ) : (
              <span>{resource.schedules.length === 1 ? '1 bloque de horario' : `${resource.schedules.length} bloques de horario`}</span>
            )}
            <span>{allServices ? 'Todos los servicios' : picked.length === 1 ? '1 servicio' : `${picked.length} servicios`}</span>
          </div>
        </div>

        <Button
          variant={open ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          data-testid={`resource-toggle-${resource.id}`}
          aria-expanded={open}
        >
          {open ? 'Cerrar' : 'Configurar'}
          <Icon name="chevronDown" className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {open && (
        <div className="border-t border-line px-4 pb-5 pt-4 md:px-5">
          {error && <p className="mb-3 text-sm text-[#a51b18]" role="alert">{error}</p>}

          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            {/* Datos */}
            <div className="min-w-0">
              <SubHeading>Datos</SubHeading>
              <Field as="div" label={`Foto del ${singularLabel.toLowerCase()}`} className="mb-3">
                <ImageUpload
                  orgId={orgId}
                  folder="resources"
                  currentUrl={resource.photo_url}
                  shape="round"
                  label="Subir foto"
                  hint="La verá el cliente al elegir con quién agendar. PNG o JPG, cuadrada, máx 5 MB."
                  onChange={async (url) => (await setResourcePhoto(resource.id, url)).ok}
                />
              </Field>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Nombre" className="min-w-[min(100%,13rem)] flex-1">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Button
                  onClick={() => run(() => saveResource({ id: resource.id, name, branchId, active: resource.active }))}
                  disabled={pending || !name.trim()}
                >
                  Guardar
                </Button>
              </div>
            </div>

            {/* Servicios */}
            <div className="min-w-0">
              <SubHeading>Servicios que presta</SubHeading>
              {services.length === 0 ? (
                <p className="text-[14.5px] text-ink-muted">Aún no hay servicios en el catálogo.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => {
                      const on = picked.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[13px] px-3 text-[14px] font-semibold transition-colors duration-150 md:min-h-[38px] ${
                            on ? 'bg-brand-50 text-brand-800 shadow-[inset_0_0_0_2px_#8073e8]' : 'bg-white text-ink shadow-[inset_0_0_0_2px_#d6dbec] hover:bg-surface'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleService(s.id)}
                            disabled={pending}
                            className={CHECKBOX}
                          />
                          {s.name}
                        </label>
                      )
                    })}
                  </div>
                  {allServices && (
                    <p className="mt-2.5 text-[13.5px] leading-snug text-ink-muted">
                      Sin ninguno marcado, {resource.name} se ofrece para{' '}
                      <strong className="text-ink">todos los servicios</strong>. Marca los suyos para limitarlo.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Horario */}
            <div className="min-w-0 md:col-span-2">
              <SubHeading>Horario propio</SubHeading>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <Field label="Día" className="w-[9.5rem] sm:w-[10.5rem]">
                  <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Desde" className="w-[9.5rem] sm:w-[10rem]">
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="tabular-nums" />
                </Field>
                <Field label="Hasta" className="w-[9.5rem] sm:w-[10rem]">
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="tabular-nums" />
                </Field>
                <Button
                  variant="secondary"
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
                >
                  <Icon name="plus" strokeWidth={2.6} />
                  Agregar
                </Button>
              </div>

              {resource.schedules.length === 0 ? (
                <p className="rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted">
                  Sin horario: no aparecerá en los huecos disponibles.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {resource.schedules.map((s) => (
                    <li
                      key={s.id}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[13px] bg-surface py-1 pl-3 pr-1 text-[14px] md:min-h-[40px]"
                    >
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
                      <b className="font-semibold text-ink">{WEEKDAYS[s.weekday]}</b>
                      <span className="tabular-nums text-ink-muted">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </span>
                      <button
                        type="button"
                        onClick={() => run(() => deleteResourceSchedule(s.id))}
                        disabled={pending}
                        className="grid h-9 w-9 place-items-center rounded-[10px] text-[#a51b18] transition-colors hover:bg-[#fde3e1] disabled:opacity-50"
                        aria-label={`Eliminar ${WEEKDAYS[s.weekday]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}
                      >
                        <Icon name="x" className="h-4 w-4" strokeWidth={2.6} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Estado */}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
            {resource.active ? (
              <Button variant="danger" size="sm" onClick={() => run(() => deactivateResource(resource.id))} disabled={pending}>
                Desactivar {singularLabel.toLowerCase()}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => run(() => reactivateResource(resource.id))} disabled={pending}>
                Reactivar
              </Button>
            )}
            <p className="min-w-0 flex-1 basis-[16rem] text-[13px] leading-snug text-ink-muted">
              Desactivar no borra su historial de citas: deja de ofrecerse para nuevas reservas.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
