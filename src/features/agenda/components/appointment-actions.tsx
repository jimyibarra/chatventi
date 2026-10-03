'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from './modal'
import { formatTime } from '../datetime'
import { setAppointmentStatus } from '../actions'
import { STATUS_META, type AppointmentStatus, type AppointmentView } from '../types'
import { apptChip } from '@/features/lineas/status'
import { buttonClass, StatusChip } from '@/shared/components/ui'

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
      <div className="space-y-4 text-[15px]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-surface px-4 py-3">
          <span className="text-[1.6rem] font-bold leading-none tabular-nums text-ink">
            {formatTime(appointment.starts_at, tz)} – {formatTime(appointment.ends_at, tz)}
          </span>
          <StatusChip tone={apptChip(appointment.status).tone} size="md" title={meta.label}>
            {apptChip(appointment.status).label}
          </StatusChip>
        </div>
        <div className="space-y-1.5 text-ink">
          <p>
            <span className="text-ink-muted">Cliente:</span>{' '}
            {appointment.client?.name || appointment.client?.phone || 'Sin cliente'}
          </p>
          <p>
            <span className="text-ink-muted">Profesional:</span>{' '}
            {appointment.resource?.name || 'Sin asignar'}
          </p>
          <p>
            <span className="text-ink-muted">Servicios:</span>{' '}
            {appointment.services.map((s) => s.name).join(', ') || '—'}
          </p>
          {appointment.notes && (
            <p>
              <span className="text-ink-muted">Notas:</span> {appointment.notes}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-[12px] bg-[#fde3e1] px-3 py-2 text-sm text-[#8f1714]" role="alert" data-testid="actions-error">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
          {TRANSITIONS.map((t) => (
            <button
              key={t.status}
              onClick={() => changeStatus(t.status)}
              disabled={pending || appointment.status === t.status}
              data-testid={t.testId}
              className={buttonClass('secondary', 'sm')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onReschedule}
          data-testid="open-reschedule"
          className={`${buttonClass('primary')} w-full`}
        >
          Reagendar
        </button>
      </div>
    </Modal>
  )
}
