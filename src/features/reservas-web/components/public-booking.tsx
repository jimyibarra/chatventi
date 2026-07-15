'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, ymdInTz } from '@/features/agenda/datetime'
import { toSingular } from '@/features/profesionales/types'

type Service = { id: string; name: string; duration_minutes: number; price: number | null }
type Resource = { id: string; name: string; photo_url: string | null; service_ids: string[] }
type Slot = { slot_start: string; slot_end: string; resource_id: string | null }

const ANY = '' // "el que sea": el motor asigna el primer profesional libre

export function PublicBooking({
  slug,
  branchId,
  tz,
  services,
  resources,
  resourceLabel,
  primaryColor,
}: {
  slug: string
  branchId: string
  tz: string
  services: Service[]
  resources: Resource[]
  resourceLabel: string
  primaryColor: string
}) {
  const supabase = createClient()
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [resourceId, setResourceId] = useState<string>(ANY)
  const [date, setDate] = useState<string>(ymdInTz(new Date(), tz))
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: Slot[] } | null>(null)
  const [pickedSlot, setPickedSlot] = useState<string>('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // Solo quien presta TODOS los servicios elegidos.
  // service_ids vacío = presta todos (regla del motor; un profesional recién
  // creado no tiene servicios configurados y debe seguir ofreciéndose).
  const eligible = resources.filter(
    (r) => r.service_ids.length === 0 || serviceIds.every((s) => r.service_ids.includes(s))
  )
  const askWho = eligible.length > 1

  // Si el elegido deja de prestar el servicio seleccionado, volvemos a "el que sea".
  const effectiveResourceId = eligible.some((r) => r.id === resourceId) ? resourceId : ANY

  const serviceKey = serviceIds.join(',')
  const requestKey =
    serviceIds.length === 0 ? null : `${branchId}|${serviceKey}|${date}|${effectiveResourceId}`
  const rawSlots = slotsResult && slotsResult.key === requestKey ? slotsResult.slots : []

  // Con "el que sea", el mismo instante llega una vez por profesional libre:
  // se muestra una sola hora y el motor decide con quién al reservar.
  const slots =
    effectiveResourceId === ANY
      ? rawSlots.filter((s, i, all) => all.findIndex((o) => o.slot_start === s.slot_start) === i)
      : rawSlots

  const loadingSlots = requestKey !== null && slotsResult?.key !== requestKey
  const selectedSlot = slots.some((s) => s.slot_start === pickedSlot) ? pickedSlot : ''

  useEffect(() => {
    if (!requestKey) return
    let active = true
    supabase
      .rpc('get_available_slots_v2', {
        p_branch_id: branchId,
        p_service_ids: serviceIds,
        p_date: date,
        p_resource_id: effectiveResourceId || undefined,
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
    const { error } = await supabase.rpc('create_public_appointment_v2', {
      p_slug: slug,
      p_service_ids: serviceIds,
      p_starts_at: selectedSlot,
      p_client_name: name,
      p_client_phone: phone,
      p_resource_id: effectiveResourceId || undefined,
    })
    setSubmitting(false)
    if (error) {
      setError(
        error.message.includes('slot_taken') || error.message.includes('no_resource_available')
          ? 'Ese horario acaba de ocuparse. Elige otro.'
          : 'No se pudo reservar. Intenta de nuevo.'
      )
      return
    }
    const withWhom =
      effectiveResourceId === ANY
        ? ''
        : ` con ${eligible.find((r) => r.id === effectiveResourceId)?.name ?? ''}`
    setDone(
      `¡Listo! Tu cita quedó reservada para el ${date} a las ${formatTime(selectedSlot, tz)}${withWhom}.`
    )
  }

  if (done) {
    return (
      <div className="rounded-card border border-success-bg bg-success-bg p-6 text-center">
        <p className="text-lg font-semibold text-success">{done}</p>
        <p className="mt-1 text-sm text-success">Te esperamos.</p>
      </div>
    )
  }

  // La numeración se ajusta: el paso "¿con quién?" solo existe si hay a quién elegir.
  let step = 0
  const n = () => ++step

  return (
    <div className="space-y-5 rounded-card border border-line bg-white p-5">
      <div>
        <h2 className="mb-2 text-base font-semibold text-ink">{n()}. Elige tu servicio</h2>
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

      {askWho && (
        <div>
          <h2 className="mb-2 text-base font-semibold text-ink">
            {n()}. Elige {toSingular(resourceLabel).toLowerCase()}{' '}
            <span className="font-normal text-ink-soft">(opcional)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setResourceId(ANY)}
              data-testid="pub-resource-any"
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
              style={
                effectiveResourceId === ANY
                  ? { borderColor: primaryColor, background: primaryColor, color: '#fff' }
                  : { borderColor: '#d1d5db', color: '#374151' }
              }
            >
              El que sea
            </button>
            {eligible.map((r) => {
              const on = effectiveResourceId === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setResourceId(r.id)}
                  data-testid="pub-resource"
                  className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm"
                  style={
                    on
                      ? { borderColor: primaryColor, background: primaryColor, color: '#fff' }
                      : { borderColor: '#d1d5db', color: '#374151' }
                  }
                >
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                      style={
                        on
                          ? { background: 'rgba(255,255,255,.25)', color: '#fff' }
                          : { background: '#f3f4f6', color: '#374151' }
                      }
                      aria-hidden
                    >
                      {r.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {r.name}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            Si te da igual, deja &ldquo;El que sea&rdquo; y te asignamos a quien esté libre.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-base font-semibold text-ink">{n()}. Elige fecha y hora</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="pub-date"
          className="mb-3 rounded-lg border border-line px-3 py-2 text-sm"
        />
        {serviceIds.length === 0 ? (
          <p className="text-sm text-ink-soft">Selecciona un servicio para ver horarios.</p>
        ) : loadingSlots ? (
          <p className="text-sm text-ink-soft">Buscando disponibilidad…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-ink-soft" data-testid="pub-no-slots">
            Sin horarios disponibles ese día
            {effectiveResourceId !== ANY ? ` con ${eligible.find((r) => r.id === effectiveResourceId)?.name}` : ''}.
          </p>
        ) : (
          <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
            {slots.map((slot) => (
              <button
                key={`${slot.slot_start}-${slot.resource_id ?? 'any'}`}
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
        <h2 className="mb-2 text-base font-semibold text-ink">{n()}. Tus datos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            data-testid="pub-name"
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono / WhatsApp"
            data-testid="pub-phone"
            className="rounded-lg border border-line px-3 py-2 text-sm"
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
