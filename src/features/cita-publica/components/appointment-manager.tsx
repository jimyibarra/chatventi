'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime, ymdInTz } from '@/features/agenda/datetime'
import { STATUS_META, type AppointmentStatus } from '@/features/agenda/types'

type Slot = { slot_start: string; slot_end: string; staff_id: string | null }

export type PublicAppointment = {
  appointment: {
    id: string
    starts_at: string
    ends_at: string
    status: string
    confirmed_by_client_at: string | null
    can_manage: boolean
  }
  services: { id: string; name: string; duration_minutes: number }[]
  branch: { id: string; name: string; timezone: string }
  org: { name: string }
}

function fmtDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

export function AppointmentManager({ token, data }: { token: string; data: PublicAppointment }) {
  const router = useRouter()
  const supabase = createClient()
  const { appointment, services, branch, org } = data
  const tz = branch.timezone

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [date, setDate] = useState<string>(ymdInTz(new Date(appointment.starts_at), tz))
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] } | null>(null)
  const [pickedSlot, setPickedSlot] = useState('')

  const serviceIds = services.map((s) => s.id)
  const requestKey = rescheduling ? `${branch.id}|${date}` : null
  const slots = slotsResult && slotsResult.key === requestKey ? slotsResult.slots : []
  const loadingSlots = requestKey !== null && slotsResult?.key !== requestKey
  const selectedSlot = slots.some((s) => s.slot_start === pickedSlot) ? pickedSlot : ''

  useEffect(() => {
    if (!requestKey) return
    let active = true
    supabase
      .rpc('get_available_slots', {
        p_branch_id: branch.id,
        p_service_ids: serviceIds,
        p_date: date,
      })
      .then(({ data: rows }) => {
        if (!active) return
        setSlotsResult({ key: requestKey, slots: (rows as Slot[] | null) ?? [] })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error: err } = await fn()
    setBusy(false)
    if (err) {
      setError(
        err.message.includes('slot_taken')
          ? 'Ese horario acaba de ocuparse. Elige otro.'
          : err.message.includes('not_actionable')
            ? 'Esta cita ya no se puede modificar.'
            : 'No se pudo completar la acción. Intenta de nuevo.'
      )
      return
    }
    setRescheduling(false)
    router.refresh()
  }

  const meta = STATUS_META[appointment.status as AppointmentStatus] ?? {
    label: appointment.status,
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
  }
  const isConfirmed = appointment.status === 'confirmed'

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Tu cita en</p>
          <h1 className="text-lg font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500">{branch.name}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          data-testid="cita-status"
        >
          {meta.label}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-sm font-semibold text-gray-900" data-testid="cita-when">
          📅 {fmtDateTime(appointment.starts_at, tz)}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          🔹 {services.map((s) => s.name).join(' + ') || 'Servicio'}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="cita-error">
          {error}
        </p>
      )}

      {appointment.can_manage && !rescheduling && (
        <div className="flex flex-wrap gap-2">
          {!isConfirmed && (
            <button
              onClick={() =>
                run(() => supabase.rpc('confirm_appointment_by_token', { p_token: token }))
              }
              disabled={busy}
              data-testid="cita-confirmar"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              ✅ Confirmar asistencia
            </button>
          )}
          <button
            onClick={() => setRescheduling(true)}
            disabled={busy}
            data-testid="cita-reagendar"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            📅 Cambiar fecha u hora
          </button>
          <button
            onClick={() => {
              if (window.confirm('¿Seguro que quieres cancelar tu cita?')) {
                run(() => supabase.rpc('cancel_appointment_by_token', { p_token: token }))
              }
            }}
            disabled={busy}
            data-testid="cita-cancelar"
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Cancelar cita
          </button>
        </div>
      )}

      {appointment.can_manage && rescheduling && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">Elige nueva fecha y hora</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="cita-fecha"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {loadingSlots ? (
            <p className="text-sm text-gray-500">Buscando disponibilidad…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="cita-no-slots">
              Sin horarios disponibles ese día.
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {slots.map((slot) => (
                <button
                  key={slot.slot_start}
                  type="button"
                  onClick={() => setPickedSlot(slot.slot_start)}
                  data-testid="cita-slot"
                  className={`rounded-lg border px-2.5 py-1 text-sm ${
                    selectedSlot === slot.slot_start
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {formatTime(slot.slot_start, tz)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() =>
                run(() =>
                  supabase.rpc('reschedule_appointment_by_token', {
                    p_token: token,
                    p_new_starts_at: selectedSlot,
                  })
                )
              }
              disabled={busy || !selectedSlot}
              data-testid="cita-reagendar-confirmar"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Confirmar cambio'}
            </button>
            <button
              onClick={() => setRescheduling(false)}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {!appointment.can_manage && (
        <p className="text-sm text-gray-500" data-testid="cita-no-gestionable">
          Esta cita ya no se puede modificar desde aquí. Si necesitas ayuda, escríbenos por el
          chat donde la agendaste.
        </p>
      )}
    </div>
  )
}
