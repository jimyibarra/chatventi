'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatTime, ymdInTz } from '@/features/agenda/datetime'
import { apptChip } from '@/features/lineas/status'
import { Button } from '@/shared/components/ui/button'
import { Card, Inset, SubHeading } from '@/shared/components/ui/card'
import { CONTROL, CONTROL_H, FIELD_LABEL } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip } from '@/shared/components/ui/status-chip'

type Slot = { slot_start: string; slot_end: string; resource_id: string | null }

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
  org: { name: string; branding?: { logo_url?: string | null } | null }
}

/** "lunes, 6 de octubre" en la zona del negocio. */
function fmtDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
}

const SLOT =
  'min-h-[44px] rounded-[12px] border-2 px-2 text-center text-[15px] font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none'

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
      .rpc('get_available_slots_v2', {
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

  // Mismos nombres y formas que en la agenda del negocio (aro = sin confirmar,
  // punto = confirmada, palomita = atendida, equis = no asistió).
  const chip = apptChip(appointment.status)
  const isConfirmed = appointment.status === 'confirmed'
  const what = services.map((s) => s.name).join(' + ') || 'Servicio'
  const minutes = services.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)

  return (
    <Card padded={false} className="p-5 sm:p-6">
      <header className="flex items-center gap-3">
        {org.branding?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.branding.logo_url} alt="" className="h-12 w-12 flex-none rounded-[14px] object-cover" />
        ) : (
          <span className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-brand-500 text-[20px] font-bold text-white" aria-hidden>
            {org.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.2rem] font-bold leading-tight text-ink [overflow-wrap:anywhere]">Tu cita en {org.name}</h1>
          <p className="truncate text-[14px] text-ink-muted">{branch.name}</p>
        </div>
      </header>

      {/* La hora es lo que el cliente viene a ver: va en grande, como en «Próxima estación». */}
      <Inset className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div data-testid="cita-when" className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-muted first-letter:uppercase">{fmtDay(appointment.starts_at, tz)}</p>
            <p className="text-[2.75rem] font-bold leading-[1.05] tracking-tight tabular-nums text-ink">
              {formatTime(appointment.starts_at, tz)}
            </p>
          </div>
          <StatusChip tone={chip.tone} size="md" testId="cita-status">
            {chip.label}
          </StatusChip>
        </div>
        <p className="mt-2.5 flex items-start gap-2 border-t border-line pt-2.5 text-[15px] text-ink">
          <Icon name="tag" className="mt-0.5 h-[18px] w-[18px] text-brand-500" />
          <span className="min-w-0">
            {what}
            {minutes > 0 && <span className="text-ink-muted"> · {minutes} min</span>}
          </span>
        </p>
      </Inset>

      {error && (
        <Notice tone="danger" size="sm" className="mt-4" testId="cita-error">
          {error}
        </Notice>
      )}

      {appointment.can_manage && !rescheduling && (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {!isConfirmed && (
            <Button
              onClick={() => run(() => supabase.rpc('confirm_appointment_by_token', { p_token: token }))}
              disabled={busy}
              data-testid="cita-confirmar"
              className="sm:col-span-2"
            >
              <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.6} />
              Confirmar asistencia
            </Button>
          )}
          <Button variant="secondary" onClick={() => setRescheduling(true)} disabled={busy} data-testid="cita-reagendar">
            <Icon name="calendar" className="h-[18px] w-[18px]" />
            Cambiar fecha u hora
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('¿Seguro que quieres cancelar tu cita?')) {
                run(() => supabase.rpc('cancel_appointment_by_token', { p_token: token }))
              }
            }}
            disabled={busy}
            data-testid="cita-cancelar"
          >
            Cancelar cita
          </Button>
        </div>
      )}

      {appointment.can_manage && rescheduling && (
        <Inset className="mt-5 space-y-3.5">
          <SubHeading className="">Elige nueva fecha y hora</SubHeading>
          <label className="block w-full max-w-[15rem]">
            <span className={FIELD_LABEL}>Día</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="cita-fecha"
              className={`${CONTROL} ${CONTROL_H} w-full`}
            />
          </label>
          {loadingSlots ? (
            <p className="text-[14.5px] text-ink-muted" aria-live="polite">
              Buscando horarios libres…
            </p>
          ) : slots.length === 0 ? (
            <p className="text-[14.5px] text-ink-muted" data-testid="cita-no-slots">
              Sin horarios disponibles ese día. Prueba con otro.
            </p>
          ) : (
            <div
              className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2 overflow-y-auto p-0.5"
              role="group"
              aria-label="Horarios libres"
            >
              {slots.map((slot) => {
                const on = selectedSlot === slot.slot_start
                return (
                  <button
                    key={slot.slot_start}
                    type="button"
                    onClick={() => setPickedSlot(slot.slot_start)}
                    data-testid="cita-slot"
                    aria-pressed={on}
                    className={`${SLOT} ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-[#d6dbec] bg-white text-ink hover:border-brand-500'}`}
                  >
                    {formatTime(slot.slot_start, tz)}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button
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
              className="flex-1"
            >
              {busy ? 'Guardando…' : 'Confirmar cambio'}
            </Button>
            <Button variant="ghost" onClick={() => setRescheduling(false)} disabled={busy}>
              Volver
            </Button>
          </div>
        </Inset>
      )}

      {!appointment.can_manage && (
        <Notice tone="info" size="sm" className="mt-4" testId="cita-no-gestionable">
          Esta cita ya no se puede modificar desde aquí. Si necesitas ayuda, escríbenos por el chat donde la
          agendaste.
        </Notice>
      )}
    </Card>
  )
}
