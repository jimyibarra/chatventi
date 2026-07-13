'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppointmentDialog } from './appointment-dialog'
import { AppointmentActions } from './appointment-actions'
import { formatTime, formatDateLabel, localMinutes, ymdInTz, addDays } from '../datetime'
import { STATUS_META, type AppointmentStatus, type AppointmentView } from '../types'

type ServiceOpt = { id: string; name: string; duration_minutes: number }
type StaffOpt = { id: string; full_name: string | null }
type BranchOpt = { id: string; name: string }

const DAY_START = 7 * 60 // 07:00
const DAY_END = 21 * 60 // 21:00
const PPM = 0.9 // px por minuto

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'actions'; appt: AppointmentView }
  | { kind: 'reschedule'; appt: AppointmentView }

export function AgendaBoard({
  branchId,
  branches,
  tz,
  view,
  date,
  weekDays,
  appointments,
  services,
  staff,
}: {
  branchId: string
  branches: BranchOpt[]
  tz: string
  view: 'day' | 'week'
  date: string
  weekDays: string[]
  appointments: AppointmentView[]
  services: ServiceOpt[]
  staff: StaffOpt[]
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })

  function navigate(next: Partial<{ view: string; date: string; branch: string }>) {
    const params = new URLSearchParams({ branch: branchId, view, date, ...next })
    router.push(`/dashboard/agenda?${params.toString()}`)
  }

  const durationMin = (a: AppointmentView) =>
    (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold text-ink">Agenda</h1>

        {branches.length > 1 && (
          <select
            value={branchId}
            onChange={(e) => navigate({ branch: e.target.value })}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex overflow-hidden rounded-lg border border-line">
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => navigate({ view: v })}
              data-testid={`view-${v}`}
              className={`px-3 py-1.5 text-sm ${
                view === v ? 'bg-brand-500 text-white' : 'bg-white text-ink-muted hover:bg-surface'
              }`}
            >
              {v === 'day' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate({ date: addDays(date, view === 'week' ? -7 : -1, tz) })}
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            onClick={() => navigate({ date: ymdInTz(new Date(), tz) })}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface"
          >
            Hoy
          </button>
          <button
            onClick={() => navigate({ date: addDays(date, view === 'week' ? 7 : 1, tz) })}
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface"
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>

        <span className="text-sm font-medium text-ink-muted" data-testid="range-label">
          {view === 'day'
            ? formatDateLabel(date, tz)
            : `${formatDateLabel(weekDays[0], tz)} – ${formatDateLabel(weekDays[6], tz)}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/agenda/configuracion"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface"
          >
            Configuración
          </Link>
          <button
            onClick={() => setDialog({ kind: 'create' })}
            data-testid="nueva-cita-btn"
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      {view === 'day' ? (
        <DayView
          tz={tz}
          appointments={appointments}
          staff={staff}
          durationMin={durationMin}
          onSelect={(appt) => setDialog({ kind: 'actions', appt })}
        />
      ) : (
        <WeekView
          tz={tz}
          weekDays={weekDays}
          appointments={appointments}
          onSelect={(appt) => setDialog({ kind: 'actions', appt })}
        />
      )}

      {/* Diálogos */}
      {dialog.kind === 'create' && (
        <AppointmentDialog
          mode="create"
          branchId={branchId}
          tz={tz}
          services={services}
          staff={staff}
          initialDate={date}
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
          staff={staff}
          initialDate={ymdInTz(new Date(dialog.appt.starts_at), tz)}
          appointment={{
            id: dialog.appt.id,
            serviceIds: dialog.appt.services.map((s) => s.id),
            staffId: dialog.appt.staff_id,
          }}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Vista DÍA: columnas por recurso (staff) + "Sin asignar"
// -------------------------------------------------------------------
function DayView({
  tz,
  appointments,
  staff,
  durationMin,
  onSelect,
}: {
  tz: string
  appointments: AppointmentView[]
  staff: StaffOpt[]
  durationMin: (a: AppointmentView) => number
  onSelect: (a: AppointmentView) => void
}) {
  const columns: { id: string | null; label: string }[] = [
    ...staff.map((s) => ({ id: s.id, label: s.full_name ?? 'Sin nombre' })),
    { id: null, label: 'Sin asignar' },
  ]
  const hours: number[] = []
  for (let h = DAY_START / 60; h <= DAY_END / 60; h++) hours.push(h)
  const gridHeight = (DAY_END - DAY_START) * PPM

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white">
      <div className="flex min-w-[640px]">
        {/* Eje de horas */}
        <div className="w-14 shrink-0 border-r border-line-row">
          <div className="h-8 border-b border-line-row" />
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute -translate-y-1/2 pr-2 text-right text-xs text-ink-faint"
                style={{ top: (h * 60 - DAY_START) * PPM, right: 0 }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* Columnas de recursos */}
        {columns.map((col) => {
          const appts = appointments.filter((a) => a.staff_id === col.id)
          return (
            <div key={col.id ?? 'none'} className="flex-1 border-r border-line-row last:border-r-0">
              <div className="flex h-8 items-center justify-center border-b border-line-row text-xs font-medium text-ink-muted">
                {col.label}
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-b border-line-row"
                    style={{ top: (h * 60 - DAY_START) * PPM }}
                  />
                ))}
                {appts.map((a) => {
                  const top = (localMinutes(a.starts_at, tz) - DAY_START) * PPM
                  const height = Math.max(durationMin(a) * PPM, 18)
                  const meta = STATUS_META[a.status as AppointmentStatus]
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      data-testid="appointment-block"
                      className={`absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs ${meta.badge}`}
                      style={{ top, height }}
                    >
                      <span className="font-medium">{formatTime(a.starts_at, tz)}</span>{' '}
                      {a.client?.name || a.client?.phone || 'Cliente'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Vista SEMANA: 7 columnas con las citas de cada día
// -------------------------------------------------------------------
function WeekView({
  tz,
  weekDays,
  appointments,
  onSelect,
}: {
  tz: string
  weekDays: string[]
  appointments: AppointmentView[]
  onSelect: (a: AppointmentView) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {weekDays.map((day) => {
        const dayAppts = appointments
          .filter((a) => ymdInTz(new Date(a.starts_at), tz) === day)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        return (
          <div key={day} className="rounded-xl border border-line bg-white p-2">
            <div className="mb-2 text-center text-xs font-medium text-ink-muted">
              {formatDateLabel(day, tz)}
            </div>
            <div className="space-y-1">
              {dayAppts.length === 0 ? (
                <p className="py-2 text-center text-xs text-ink-faint">—</p>
              ) : (
                dayAppts.map((a) => {
                  const meta = STATUS_META[a.status as AppointmentStatus]
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      data-testid="appointment-block"
                      className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-xs ${meta.badge}`}
                    >
                      <span className="font-medium">{formatTime(a.starts_at, tz)}</span>{' '}
                      {a.client?.name || a.client?.phone || 'Cliente'}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
