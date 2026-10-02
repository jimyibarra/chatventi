'use client'

import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppointmentDialog } from './appointment-dialog'
import { AppointmentActions } from './appointment-actions'
import { formatTime, ymdInTz, addDays } from '../datetime'
import { type AppointmentView } from '../types'
import { Legend, LinesDiagram } from '@/features/lineas/components/lines-diagram'
import { STATE_LABEL, type DayModel, type StationState } from '@/features/lineas/model'

type ServiceOpt = { id: string; name: string; duration_minutes: number }
type ResourceOpt = { id: string; name: string }
type BranchOpt = { id: string; name: string }
type Vars = CSSProperties & Record<`--${string}`, string | number>

type DialogState =
  | { kind: 'none' }
  | { kind: 'create'; resourceId?: string | null }
  | { kind: 'actions'; appt: AppointmentView }
  | { kind: 'reschedule'; appt: AppointmentView }

/** "vie 2 oct" (o "2 de oct" sin día de la semana) para una fecha YYYY-MM-DD. */
function shortDay(d: string, weekday = true): string {
  const [y, m, dd] = d.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, dd, 12))
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', ...o }).format(at)
  const month = fmt({ month: 'short' }).replace('.', '')
  return weekday ? `${fmt({ weekday: 'short' }).replace('.', '')} ${dd} ${month}` : `${dd} de ${month}`
}

const TOOL =
  'inline-flex min-h-[40px] items-center justify-center rounded-[13px] border-2 border-ink bg-white px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50'

// Agenda «Líneas»: el día es un plano del Metro. Cada profesional es una
// línea de color; cada cita, una estación que se abre al tocarla; cada hueco
// libre, un tramo punteado desde el que se agenda.
export function AgendaBoard({
  branchId,
  branches,
  tz,
  view,
  date,
  weekDays,
  day,
  appointments,
  services,
  resources,
  resourceLabel,
  openNew,
  newResourceId,
}: {
  branchId: string
  branches: BranchOpt[]
  tz: string
  view: 'day' | 'week'
  date: string
  weekDays: string[]
  /** El día ya armado en el servidor (así servidor y navegador pintan lo mismo). */
  day: DayModel
  appointments: AppointmentView[]
  services: ServiceOpt[]
  resources: ResourceOpt[]
  resourceLabel: string
  /** Llegó con ?new=1 (desde el Panel): abrir "Nueva cita" de entrada. */
  openNew?: boolean
  newResourceId?: string | null
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>(
    openNew ? { kind: 'create', resourceId: newResourceId } : { kind: 'none' }
  )
  // null = todas las líneas.
  const [only, setOnly] = useState<string | null>(null)

  function navigate(next: Partial<{ view: string; date: string; branch: string }>) {
    const params = new URLSearchParams({ branch: branchId, view, date, ...next })
    router.push(`/dashboard/agenda?${params.toString()}`)
  }

  const today = ymdInTz(new Date(), tz)
  const longDate = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, dd, 12))
    )
  }
  const heading =
    view === 'day'
      ? `${date === today ? 'Hoy, ' : ''}${longDate(date)}`
      : `Semana del ${shortDay(weekDays[0], false)} al ${shortDay(weekDays[6], false)}`

  const key = (id: string | null) => id ?? 'none'
  const shown = only === null ? day.lines : day.lines.filter((l) => key(l.id) === only)
  const meta = new Map(day.lines.map((l) => [key(l.id), l]))

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-4 md:px-6 md:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="mr-auto min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink">Agenda</h1>
          <p className="text-[15px] text-ink-muted first-letter:uppercase" data-testid="range-label">{heading}</p>
        </div>
        <Link href="/dashboard/agenda/configuracion" className={TOOL}>
          Configuración
        </Link>
        <button
          onClick={() => setDialog({ kind: 'create' })}
          data-testid="nueva-cita-btn"
          className="inline-flex min-h-[40px] items-center rounded-[13px] bg-brand-500 px-4 text-[15px] font-semibold text-white shadow-btn transition-colors hover:bg-brand-600"
        >
          + Nueva cita
        </button>
      </header>

      {/* Barra de herramientas */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-[16px] bg-[#e3e6f3] p-1" role="group" aria-label="Vista">
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => navigate({ view: v })}
              data-testid={`view-${v}`}
              aria-pressed={view === v}
              className={`min-h-[40px] rounded-[12px] px-5 text-[15px] font-semibold transition-colors ${
                view === v ? 'bg-ink text-white' : 'text-ink hover:bg-white/60'
              }`}
            >
              {v === 'day' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate({ date: addDays(date, view === 'week' ? -7 : -1, tz) })} className={`${TOOL} px-3`} aria-label="Anterior">
            ‹
          </button>
          <button onClick={() => navigate({ date: today })} className={TOOL}>
            Hoy
          </button>
          <button onClick={() => navigate({ date: addDays(date, view === 'week' ? 7 : 1, tz) })} className={`${TOOL} px-3`} aria-label="Siguiente">
            ›
          </button>
        </div>

        {branches.length > 1 && (
          <select value={branchId} onChange={(e) => navigate({ branch: e.target.value })} className={`${TOOL} pr-8`} aria-label="Sucursal">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {/* Filtro por línea */}
        {day.lines.length > 1 && (
          <div className="ln flex flex-wrap items-center gap-2 md:ml-auto" role="group" aria-label={`Filtrar por ${resourceLabel.toLowerCase()}`}>
            <button
              onClick={() => setOnly(null)}
              aria-pressed={only === null}
              className={`min-h-[40px] rounded-full px-4 text-[15px] font-semibold transition-colors ${
                only === null ? 'bg-ink text-white' : 'border-2 border-ink bg-white text-ink hover:bg-brand-50'
              }`}
            >
              Todas
            </button>
            {day.lines.map((l) => {
              const on = only === key(l.id)
              return (
                <button
                  key={key(l.id)}
                  onClick={() => setOnly(on ? null : key(l.id))}
                  aria-pressed={on}
                  data-testid="line-filter"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border-2 py-1 pl-1.5 pr-3.5 text-[15px] font-semibold transition-colors"
                  style={{ '--c': l.color, borderColor: l.color, background: on ? l.color : '#fff', color: on ? '#fff' : '#2a1a5e' } as Vars}
                >
                  <span className="ln-badge" style={on ? { background: '#fff', color: l.color } : undefined}>{l.n}</span>
                  {l.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {view === 'day' ? (
        <section className="rounded-[20px] bg-white p-4 shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)] md:p-5" aria-label="Agenda del día">
          <LinesDiagram
            day={{ ...day, lines: shown }}
            mode="agenda"
            onSelect={(appt) => setDialog({ kind: 'actions', appt })}
            onGap={(resourceId) => setDialog({ kind: 'create', resourceId })}
          />
          {day.lines.every((l) => l.stations.length === 0) && (
            <p className="rounded-[14px] bg-surface p-4 text-[15px] text-ink-muted">
              No hay citas este día. Toca <b className="text-ink">+ Nueva cita</b> o un tramo punteado para agendar.
            </p>
          )}
          <Legend />
        </section>
      ) : (
        <WeekView
          tz={tz}
          weekDays={weekDays}
          today={today}
          appointments={appointments.filter((a) => a.status !== 'cancelled' && (only === null || key(a.resource_id) === only))}
          colorOf={(a) => meta.get(key(a.resource_id))?.color ?? '#584d84'}
          onSelect={(appt) => setDialog({ kind: 'actions', appt })}
          onDay={(d) => navigate({ view: 'day', date: d })}
        />
      )}

      {/* Diálogos */}
      {dialog.kind === 'create' && (
        <AppointmentDialog
          mode="create"
          branchId={branchId}
          tz={tz}
          services={services}
          resources={resources}
          resourceLabel={resourceLabel}
          initialDate={date}
          initialResourceId={dialog.resourceId}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'actions' && (
        <AppointmentActions
          appointment={dialog.appt}
          tz={tz}
          onReschedule={() => setDialog({ kind: 'reschedule', appt: dialog.appt })}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'reschedule' && (
        <AppointmentDialog
          mode="reschedule"
          branchId={branchId}
          tz={tz}
          services={services}
          resources={resources}
          resourceLabel={resourceLabel}
          initialDate={ymdInTz(new Date(dialog.appt.starts_at), tz)}
          appointment={{
            id: dialog.appt.id,
            serviceIds: dialog.appt.services.map((s) => s.id),
            resourceId: dialog.appt.resource_id,
          }}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Vista SEMANA: siete paradas; cada cita lleva el color de su línea.
// -------------------------------------------------------------------
const WEEK_STATE: Record<string, StationState> = {
  scheduled: 'wait',
  confirmed: 'ok',
  completed: 'done',
  no_show: 'noshow',
}

function WeekView({
  tz,
  weekDays,
  today,
  appointments,
  colorOf,
  onSelect,
  onDay,
}: {
  tz: string
  weekDays: string[]
  today: string
  appointments: AppointmentView[]
  colorOf: (a: AppointmentView) => string
  onSelect: (a: AppointmentView) => void
  onDay: (date: string) => void
}) {
  return (
    <div className="ln grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
      {weekDays.map((d) => {
        const dayAppts = appointments
          .filter((a) => ymdInTz(new Date(a.starts_at), tz) === d)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        const isToday = d === today
        return (
          <section key={d} className={`rounded-[18px] bg-white p-2.5 shadow-[0_1px_0_#dde2f0] ${isToday ? 'ring-2 ring-ink' : ''}`}>
            <button
              onClick={() => onDay(d)}
              className="mb-2 flex w-full items-center justify-between rounded-[10px] px-1.5 py-1 text-left text-[13.5px] font-semibold text-ink hover:bg-brand-50"
            >
              <span className="first-letter:uppercase">{shortDay(d)}</span>
              <span className="text-ink-muted">{dayAppts.length || ''}</span>
            </button>
            <div className="space-y-1.5">
              {dayAppts.length === 0 ? (
                <p className="py-3 text-center text-[13px] text-ink-muted">Libre</p>
              ) : (
                dayAppts.map((a) => {
                  const st = WEEK_STATE[a.status] ?? 'wait'
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      data-testid="appointment-block"
                      title={STATE_LABEL[st]}
                      className="block w-full rounded-[10px] border-l-[5px] bg-surface px-2 py-1.5 text-left text-[13px] leading-tight text-ink transition-colors hover:bg-brand-50"
                      style={{ borderColor: st === 'done' ? '#a9a5bf' : colorOf(a), opacity: st === 'done' ? 0.75 : 1 }}
                    >
                      <b className="font-bold tabular-nums">{formatTime(a.starts_at, tz)}</b>{' '}
                      <span className="break-words">{a.client?.name || a.client?.phone || 'Cliente'}</span>
                      {st === 'wait' && <span className="ln-chip ml-1" data-st="wait">Sin confirmar</span>}
                    </button>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
