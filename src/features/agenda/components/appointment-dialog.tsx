'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from './modal'
import { formatTime } from '../datetime'
import { fetchSlots, createAppointment, rescheduleAppointment } from '../actions'
import type { Slot } from '../types'

type ServiceOpt = { id: string; name: string; duration_minutes: number }
type StaffOpt = { id: string; full_name: string | null }

export function AppointmentDialog({
  mode,
  branchId,
  tz,
  services,
  staff,
  initialDate,
  appointment,
  onClose,
}: {
  mode: 'create' | 'reschedule'
  branchId: string
  tz: string
  services: ServiceOpt[]
  staff: StaffOpt[]
  initialDate: string
  appointment?: { id: string; serviceIds: string[]; staffId: string | null }
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [serviceIds, setServiceIds] = useState<string[]>(
    mode === 'reschedule' ? (appointment?.serviceIds ?? []) : []
  )
  const [staffId, setStaffId] = useState<string>(appointment?.staffId ?? '')
  const [date, setDate] = useState<string>(initialDate)
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] } | null>(null)
  const [pickedSlot, setPickedSlot] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const serviceKey = serviceIds.join(',')
  // Slots, loading y selección se derivan de la clave de la request vigente:
  // al cambiar fecha/servicios/staff la clave cambia y lo anterior queda invalidado solo.
  const requestKey =
    serviceIds.length === 0 ? null : `${branchId}|${serviceKey}|${date}|${staffId}`
  const slots = slotsResult && slotsResult.key === requestKey ? slotsResult.slots : []
  const loadingSlots = requestKey !== null && slotsResult?.key !== requestKey
  const selectedSlot = slots.some((s) => s.slot_start === pickedSlot) ? pickedSlot : ''

  // Carga de disponibilidad al cambiar fecha/servicios/staff.
  useEffect(() => {
    if (!requestKey) return
    let active = true
    fetchSlots({ branchId, serviceIds, date, staffId: staffId || null }).then((res) => {
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
              staffId: staffId || null,
              clientName: clientName || undefined,
              clientPhone: clientPhone || undefined,
              notes: notes || undefined,
            })
          : await rescheduleAppointment({
              appointmentId: appointment!.id,
              newStartsAt: selectedSlot,
              newStaffId: staffId || null,
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Servicios</label>
            {services.length === 0 ? (
              <p className="text-sm text-amber-700">
                No hay servicios activos. Créalos en Configuración.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    data-testid="service-chip"
                    className={`rounded-full border px-3 py-1 text-sm ${
                      serviceIds.includes(s.id)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s.name} · {s.duration_minutes}m
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="date-input"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Profesional
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              data-testid="staff-select"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Cualquiera / sin asignar</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Horarios disponibles
          </label>
          {loadingSlots ? (
            <p className="text-sm text-gray-500">Buscando disponibilidad…</p>
          ) : serviceIds.length === 0 ? (
            <p className="text-sm text-gray-500">Selecciona un servicio para ver horarios.</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="no-slots">
              Sin horarios disponibles ese día.
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {slots.map((slot) => (
                <button
                  key={`${slot.slot_start}-${slot.staff_id}`}
                  type="button"
                  onClick={() => setPickedSlot(slot.slot_start)}
                  data-testid="slot-option"
                  className={`rounded-lg border px-2.5 py-1 text-sm ${
                    selectedSlot === slot.slot_start
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {formatTime(slot.slot_start, tz)}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'create' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cliente (nombre)
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                data-testid="client-name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                data-testid="client-phone"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="dialog-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={pending || !selectedSlot}
            data-testid="submit-appointment"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : mode === 'create' ? 'Agendar' : 'Reagendar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
