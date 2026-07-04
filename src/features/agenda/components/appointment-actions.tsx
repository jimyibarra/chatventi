'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from './modal'
import { formatTime } from '../datetime'
import { setAppointmentStatus } from '../actions'
import { STATUS_META, type AppointmentStatus, type AppointmentView } from '../types'

const TRANSITIONS: { status: AppointmentStatus; label: string; testId: string }[] = [
  { status: 'confirmed', label: 'Confirmar', testId: 'status-confirmed' },
  { status: 'completed', label: 'Completar', testId: 'status-completed' },
  { status: 'no_show', label: 'No asistió', testId: 'status-no_show' },
  { status: 'cancelled', label: 'Cancelar cita', testId: 'status-cancelled' },
]

export function AppointmentActions({
  appointment,
  tz,
  onReschedule,
  onClose,
}: {
  appointment: AppointmentView
  tz: string
  onReschedule: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const meta = STATUS_META[appointment.status as AppointmentStatus]

  function changeStatus(status: AppointmentStatus) {
    setError(null)
    startTransition(async () => {
      const res = await setAppointmentStatus({ appointmentId: appointment.id, status })
      if (res.ok) {
        router.refresh()
        onClose()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Modal title="Detalle de la cita" onClose={onClose} testId="appointment-actions">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">
            {formatTime(appointment.starts_at, tz)} – {formatTime(appointment.ends_at, tz)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${meta.badge}`}>
            {meta.label}
          </span>
        </div>
        <div className="space-y-1 text-gray-600">
          <p>
            <span className="text-gray-400">Cliente:</span>{' '}
            {appointment.client?.name || appointment.client?.phone || 'Sin cliente'}
          </p>
          <p>
            <span className="text-gray-400">Profesional:</span>{' '}
            {appointment.staff?.full_name || 'Sin asignar'}
          </p>
          <p>
            <span className="text-gray-400">Servicios:</span>{' '}
            {appointment.services.map((s) => s.name).join(', ') || '—'}
          </p>
          {appointment.notes && (
            <p>
              <span className="text-gray-400">Notas:</span> {appointment.notes}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700" data-testid="actions-error">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          {TRANSITIONS.map((t) => (
            <button
              key={t.status}
              onClick={() => changeStatus(t.status)}
              disabled={pending || appointment.status === t.status}
              data-testid={t.testId}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onReschedule}
          data-testid="open-reschedule"
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reagendar
        </button>
      </div>
    </Modal>
  )
}
