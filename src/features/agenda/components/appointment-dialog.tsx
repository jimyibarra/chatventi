'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from './modal'
import { formatTime } from '../datetime'
import { fetchSlots, createAppointment, rescheduleAppointment } from '../actions'
import type { Slot } from '../types'
import { Button } from '@/shared/components/ui/button'
import { Field, FIELD_LABEL, Input, Select, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

type ServiceOpt = { id: string; name: string; duration_minutes: number }
type ResourceOpt = { id: string; name: string }

export function AppointmentDialog({
  mode,
  branchId,
  tz,
  services,
  resources,
  resourceLabel,
  initialDate,
  initialResourceId,
  appointment,
  onClose,
}: {
  mode: 'create' | 'reschedule'
  branchId: string
  tz: string
  services: ServiceOpt[]
  resources: ResourceOpt[]
  resourceLabel: string
  initialDate: string
  /** Profesional preseleccionado (al agendar desde un hueco de su línea). */
  initialResourceId?: string | null
  appointment?: { id: string; serviceIds: string[]; resourceId: string | null }
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [serviceIds, setServiceIds] = useState<string[]>(
    mode === 'reschedule' ? (appointment?.serviceIds ?? []) : []
  )
  const [resourceId, setResourceId] = useState<string>(
    appointment?.resourceId ?? (resources.some((r) => r.id === initialResourceId) ? (initialResourceId ?? '') : '')
  )
  const [date, setDate] = useState<string>(initialDate)
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] } | null>(null)
  const [pickedSlot, setPickedSlot] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const serviceKey = serviceIds.join(',')
  // Slots, loading y selección se derivan de la clave de la request vigente:
  // al cambiar fecha/servicios/profesional la clave cambia y lo anterior queda invalidado solo.
  const requestKey =
    serviceIds.length === 0 ? null : `${branchId}|${serviceKey}|${date}|${resourceId}`
  const rawSlots = slotsResult && slotsResult.key === requestKey ? slotsResult.slots : []

  // Con "cualquiera", el mismo instante llega una vez por profesional libre.
  // Se muestra una sola hora: el motor elige a quién asignar al reservar.
  const slots =
    resourceId === ''
      ? rawSlots.filter(
          (s, i, all) => all.findIndex((o) => o.slot_start === s.slot_start) === i
        )
      : rawSlots

  const loadingSlots = requestKey !== null && slotsResult?.key !== requestKey
  const selectedSlot = slots.some((s) => s.slot_start === pickedSlot) ? pickedSlot : ''

  // Carga de disponibilidad al cambiar fecha/servicios/profesional.
  useEffect(() => {
    if (!requestKey) return
    let active = true
    fetchSlots({ branchId, serviceIds, date, resourceId: resourceId || null }).then((res) => {
      if (!active) return
      if (res.ok) {
        setSlotsResult({ key: requestKey, slots: res.data ?? [] })
      } else {
        setSlotsResult({ key: requestKey, slots: [] })
        setError(res.error)
      }
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  function onSubmit() {
    setError(null)
    if (!selectedSlot) {
      setError('Elige un horario disponible.')
      return
    }
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createAppointment({
              branchId,
              serviceIds,
              startsAt: selectedSlot,
              resourceId: resourceId || null,
              clientName: clientName || undefined,
              clientPhone: clientPhone || undefined,
              notes: notes || undefined,
            })
          : await rescheduleAppointment({
              appointmentId: appointment!.id,
              newStartsAt: selectedSlot,
              newResourceId: resourceId || null,
            })
      if (res.ok) {
        router.refresh()
        onClose()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Modal
      title={mode === 'create' ? 'Nueva cita' : 'Reagendar cita'}
      onClose={onClose}
      testId="appointment-dialog"
    >
      <div className="space-y-4">
        {mode === 'create' && (
          <div>
            <p className={FIELD_LABEL}>Servicios</p>
            {services.length === 0 ? (
              <p className="rounded-[14px] bg-surface p-3 text-[14.5px] text-ink-muted">
                No hay servicios activos. Créalos en Configuración.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = serviceIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      data-testid="service-chip"
                      aria-pressed={on}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-colors duration-150 md:min-h-[38px] ${
                        on ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_2px_#d6dbec] hover:bg-brand-50'
                      }`}
                    >
                      {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
                      {s.name}
                      <span className={`tabular-nums ${on ? 'text-white/75' : 'text-ink-muted'}`}>· {s.duration_minutes} min</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="date-input" />
          </Field>
          <Field label={resourceLabel}>
            <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)} data-testid="resource-select">
              <option value="">El que sea</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className={FIELD_LABEL}>Horarios disponibles</p>
          {loadingSlots ? (
            <p className="flex items-center gap-2 rounded-[14px] bg-surface p-3 text-[14.5px] text-ink-muted" role="status">
              <Icon name="clock" className="h-4 w-4" />
              Buscando disponibilidad…
            </p>
          ) : serviceIds.length === 0 ? (
            <p className="rounded-[14px] bg-surface p-3 text-[14.5px] text-ink-muted">Selecciona un servicio para ver horarios.</p>
          ) : slots.length === 0 ? (
            <p className="rounded-[14px] bg-surface p-3 text-[14.5px] text-ink-muted" data-testid="no-slots">
              Sin horarios disponibles ese día.
            </p>
          ) : (
            <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto p-0.5 sm:grid-cols-5">
              {slots.map((slot) => {
                const on = selectedSlot === slot.slot_start
                return (
                  <button
                    key={`${slot.slot_start}-${slot.resource_id ?? 'any'}`}
                    type="button"
                    onClick={() => setPickedSlot(slot.slot_start)}
                    data-testid="slot-option"
                    aria-pressed={on}
                    className={`min-h-[44px] rounded-[12px] text-[15px] font-semibold tabular-nums transition-colors duration-150 md:min-h-[40px] ${
                      on ? 'bg-brand-500 text-white shadow-btn' : 'bg-surface text-ink hover:bg-brand-50'
                    }`}
                  >
                    {formatTime(slot.slot_start, tz)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {mode === 'create' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente (nombre)">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} data-testid="client-name" />
            </Field>
            <Field label="Teléfono">
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} data-testid="client-phone" inputMode="tel" className="tabular-nums" />
            </Field>
          </div>
        )}

        {mode === 'create' && (
          <Field label="Notas">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        )}

        {error && (
          <p className="rounded-[12px] bg-[#fde3e1] px-3 py-2 text-sm text-[#8f1714]" role="alert" data-testid="dialog-error">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !selectedSlot} data-testid="submit-appointment">
            {pending ? 'Guardando…' : mode === 'create' ? 'Agendar' : 'Reagendar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
