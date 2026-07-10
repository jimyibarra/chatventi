'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, ymdInTz } from '@/features/agenda/datetime'

type Service = { id: string; name: string; duration_minutes: number; price: number | null }
type Slot = { slot_start: string; slot_end: string; staff_id: string | null }

export function PublicBooking({
  slug,
  branchId,
  tz,
  services,
  primaryColor,
}: {
  slug: string
  branchId: string
  tz: string
  services: Service[]
  primaryColor: string
}) {
  const supabase = createClient()
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState<string>(ymdInTz(new Date(), tz))
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] } | null>(null)
  const [pickedSlot, setPickedSlot] = useState<string>('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const serviceKey = serviceIds.join(',')
  // Slots, loading y selección derivados de la clave de la request vigente.
  const requestKey = serviceIds.length === 0 ? null : `${branchId}|${serviceKey}|${date}`
  const slots = slotsResult && slotsResult.key === requestKey ? slotsResult.slots : []
  const loadingSlots = requestKey !== null && slotsResult?.key !== requestKey
  const selectedSlot = slots.some((s) => s.slot_start === pickedSlot) ? pickedSlot : ''

  useEffect(() => {
    if (!requestKey) return
    let active = true
    supabase
      .rpc('get_available_slots', {
        p_branch_id: branchId,
        p_service_ids: serviceIds,
        p_date: date,
      })
      .then(({ data }) => {
        if (!active) return
        setSlotsResult({ key: requestKey, slots: (data as Slot[] | null) ?? [] })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function submit() {
    setError(null)
    if (!selectedSlot) return setError('Elige un horario.')
    if (!phone.trim()) return setError('Ingresa tu teléfono.')
    setSubmitting(true)
    const { error } = await supabase.rpc('create_public_appointment', {
      p_slug: slug,
      p_service_ids: serviceIds,
      p_starts_at: selectedSlot,
      p_client_name: name,
      p_client_phone: phone,
    })
    setSubmitting(false)
    if (error) {
      setError(
        error.message.includes('slot_taken')
          ? 'Ese horario acaba de ocuparse. Elige otro.'
          : 'No se pudo reservar. Intenta de nuevo.'
      )
      return
    }
    setDone(`¡Listo! Tu cita quedó reservada para el ${date} a las ${formatTime(selectedSlot, tz)}.`)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">{done}</p>
        <p className="mt-1 text-sm text-emerald-700">Te esperamos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="mb-2 text-base font-semibold text-gray-900">1. Elige tu servicio</h2>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleService(s.id)}
              data-testid="pub-service"
              className="rounded-full border px-3 py-1 text-sm"
              style={
                serviceIds.includes(s.id)
                  ? { borderColor: primaryColor, background: primaryColor, color: '#fff' }
                  : { borderColor: '#d1d5db', color: '#374151' }
              }
            >
              {s.name}
              {s.price != null ? ` · $${s.price}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold text-gray-900">2. Elige fecha y hora</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="pub-date"
          className="mb-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {serviceIds.length === 0 ? (
          <p className="text-sm text-gray-500">Selecciona un servicio para ver horarios.</p>
        ) : loadingSlots ? (
          <p className="text-sm text-gray-500">Buscando disponibilidad…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-500" data-testid="pub-no-slots">
            Sin horarios disponibles ese día.
          </p>
        ) : (
          <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
            {slots.map((slot) => (
              <button
                key={slot.slot_start}
                type="button"
                onClick={() => setPickedSlot(slot.slot_start)}
                data-testid="pub-slot"
                className="rounded-lg border px-2.5 py-1 text-sm"
                style={
                  selectedSlot === slot.slot_start
                    ? { borderColor: primaryColor, background: primaryColor, color: '#fff' }
                    : { borderColor: '#d1d5db', color: '#374151' }
                }
              >
                {formatTime(slot.slot_start, tz)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold text-gray-900">3. Tus datos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            data-testid="pub-name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono / WhatsApp"
            data-testid="pub-phone"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="pub-error">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !selectedSlot || !phone.trim()}
        data-testid="pub-submit"
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: primaryColor }}
      >
        {submitting ? 'Reservando…' : 'Reservar cita'}
      </button>
    </div>
  )
}
