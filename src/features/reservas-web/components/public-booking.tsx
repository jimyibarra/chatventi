'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime, ymdInTz } from '@/features/agenda/datetime'
import { toSingular } from '@/features/profesionales/types'
import { Card } from '@/shared/components/ui/card'
import { CONTROL, CONTROL_H, FIELD_LABEL } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { fmtMoney } from '@/shared/lib/format'

type Service = { id: string; name: string; duration_minutes: number; price: number | null; price_text?: string | null }
type Resource = { id: string; name: string; photo_url: string | null; service_ids: string[] }
type Slot = { slot_start: string; slot_end: string; resource_id: string | null }

const ANY = '' // "el que sea": el motor asigna el primer profesional libre

// El color del negocio llega por variables CSS que pone la página:
// --brand (fondo), --on-brand (texto encima) y --brand-ink (trazo sobre blanco).
const CHOICE =
  'rounded-[13px] border-2 transition-[background-color,border-color,transform] duration-150 active:scale-[.98] motion-reduce:transition-none focus-visible:outline-[color:var(--brand-ink)]'
const CHOICE_OFF = 'border-[#d6dbec] bg-white text-ink hover:border-[color:var(--brand-ink)]'
const CHOICE_ON = 'border-[color:var(--brand)] bg-[color:var(--brand)] text-[color:var(--on-brand)]'

function choice(on: boolean): string {
  return `${CHOICE} ${on ? CHOICE_ON : CHOICE_OFF}`
}

/** "lunes 6 de octubre" a partir de un YYYY-MM-DD (sin corrimiento de zona). */
function fmtLongDay(ymd: string): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${ymd}T12:00:00Z`)
  )
}

/**
 * Un paso de la reserva como una estación de la línea del negocio: hueca
 * mientras falta, rellena con palomita cuando ya está. El tramo que la une con
 * la siguiente se pinta del color del negocio al completarse.
 */
function Step({
  n,
  done,
  last,
  title,
  aside,
  children,
}: {
  n: number
  done: boolean
  last?: boolean
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
      {!last && (
        <span
          aria-hidden
          className={`absolute bottom-0 left-[14.5px] top-9 w-[3px] rounded-full transition-colors duration-300 ${
            done ? 'bg-[color:var(--brand)]' : 'bg-line'
          }`}
        />
      )}
      <span
        aria-hidden
        className={`relative grid h-8 w-8 place-items-center rounded-full text-[14px] font-bold tabular-nums transition-colors duration-300 ${
          done
            ? 'bg-[color:var(--brand)] text-[color:var(--on-brand)]'
            : 'border-[3px] border-[color:var(--brand-ink)] bg-white text-[color:var(--brand-ink)]'
        }`}
      >
        {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : n}
      </span>
      <div className={`min-w-0 ${last ? '' : 'pb-7'}`}>
        <h2 className="flex min-h-8 flex-wrap items-baseline gap-x-2 pt-0.5 text-[17px] font-bold leading-snug text-ink">
          <span className="sr-only">{`Paso ${n}${done ? ', listo' : ''}: `}</span>
          {title}
          {aside}
        </h2>
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  )
}

export function PublicBooking({
  slug,
  branchId,
  tz,
  services,
  resources,
  resourceLabel,
}: {
  slug: string
  branchId: string
  tz: string
  services: Service[]
  resources: Resource[]
  resourceLabel: string
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
  const [done, setDone] = useState<{ day: string; time: string; withWhom: string } | null>(null)

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
      effectiveResourceId === ANY ? '' : (eligible.find((r) => r.id === effectiveResourceId)?.name ?? '')
    setDone({ day: fmtLongDay(date), time: formatTime(selectedSlot, tz), withWhom })
  }

  if (done) {
    return (
      <Card className="text-center" aria-live="polite">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[color:var(--brand)] text-[color:var(--on-brand)] shadow-[inset_0_0_0_4px_#fff,0_0_0_3px_var(--brand)]">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.6} />
        </span>
        <p className="text-[1.35rem] font-bold leading-tight text-ink">¡Listo! Tu cita quedó reservada</p>
        <p className="mt-3 text-[15px] font-semibold text-ink-muted first-letter:uppercase">{done.day}</p>
        <p className="text-[2.6rem] font-bold leading-none tabular-nums tracking-tight text-ink">{done.time}</p>
        {done.withWhom && <p className="mt-2 text-[15px] text-ink-muted">con {done.withWhom}</p>}
        <p className="mt-4 text-[15px] text-ink">Te esperamos.</p>
      </Card>
    )
  }

  // La numeración se ajusta: el paso "¿con quién?" solo existe si hay a quién elegir.
  let step = 0
  const n = () => ++step
  const whoName = eligible.find((r) => r.id === effectiveResourceId)?.name

  return (
    <Card padded={false} className="p-4 sm:p-6">
      <ol>
        <Step n={n()} done={serviceIds.length > 0} title="Elige tu servicio" aside={<span className="text-[13.5px] font-normal text-ink-muted">Puedes elegir varios</span>}>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => {
              const on = serviceIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  data-testid="pub-service"
                  aria-pressed={on}
                  className={`${choice(on)} flex min-h-[56px] items-center gap-3 px-3.5 py-2.5 text-left`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">{s.name}</span>
                    <span className={`block text-[13px] tabular-nums ${on ? 'opacity-90' : 'text-ink-muted'}`}>
                      {s.duration_minutes} min{s.price_text ? ` · ${s.price_text}` : s.price != null ? ` · ${fmtMoney(s.price)}` : ''}
                    </span>
                  </span>
                  <Icon name={on ? 'check' : 'plus'} className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </button>
              )
            })}
          </div>
        </Step>

        {askWho && (
          <Step
            n={n()}
            done={serviceIds.length > 0}
            title={`Elige ${toSingular(resourceLabel).toLowerCase()}`}
            aside={<span className="text-[13.5px] font-normal text-ink-muted">(opcional)</span>}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setResourceId(ANY)}
                data-testid="pub-resource-any"
                aria-pressed={effectiveResourceId === ANY}
                className={`${choice(effectiveResourceId === ANY)} inline-flex min-h-[44px] items-center gap-2 px-3.5 text-[15px] font-semibold`}
              >
                <Icon name="users" className="h-[18px] w-[18px]" />
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
                    aria-pressed={on}
                    className={`${choice(on)} inline-flex min-h-[44px] items-center gap-2 py-1 pl-1.5 pr-3.5 text-[15px] font-semibold`}
                  >
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-[14px] font-bold ${
                          on ? 'bg-white/25' : 'bg-brand-50 text-brand-700'
                        }`}
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
            <p className="mt-2 text-[13.5px] text-ink-muted">
              Si te da igual, deja «El que sea» y te asignamos a quien esté libre.
            </p>
          </Step>
        )}

        <Step n={n()} done={!!selectedSlot} title="Elige fecha y hora">
          <label className="mb-3 block w-full max-w-[15rem]">
            <span className={FIELD_LABEL}>Día</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="pub-date"
              className={`${CONTROL} ${CONTROL_H} w-full`}
            />
          </label>
          {serviceIds.length === 0 ? (
            <p className="rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted">
              Elige un servicio para ver los horarios libres.
            </p>
          ) : loadingSlots ? (
            <p className="flex items-center gap-2.5 rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted" aria-live="polite">
              <span className="flex gap-1" aria-hidden>
                <i className="cv-dot !bg-[color:var(--brand-ink)]" />
                <i className="cv-dot !bg-[color:var(--brand-ink)]" />
                <i className="cv-dot !bg-[color:var(--brand-ink)]" />
              </span>
              Buscando horarios libres…
            </p>
          ) : slots.length === 0 ? (
            <p className="rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted" data-testid="pub-no-slots">
              Sin horarios disponibles ese día
              {effectiveResourceId !== ANY ? ` con ${whoName}` : ''}. Prueba con otro día.
            </p>
          ) : (
            <div
              className="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2 overflow-y-auto p-0.5"
              role="group"
              aria-label="Horarios libres"
            >
              {slots.map((slot) => {
                const on = selectedSlot === slot.slot_start
                return (
                  <button
                    key={`${slot.slot_start}-${slot.resource_id ?? 'any'}`}
                    type="button"
                    onClick={() => setPickedSlot(slot.slot_start)}
                    data-testid="pub-slot"
                    aria-pressed={on}
                    className={`${choice(on)} min-h-[44px] px-2 text-center text-[15px] font-semibold tabular-nums`}
                  >
                    {formatTime(slot.slot_start, tz)}
                  </button>
                )
              })}
            </div>
          )}
        </Step>

        <Step n={n()} done={!!phone.trim()} last title="Tus datos">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={FIELD_LABEL}>Nombre</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                data-testid="pub-name"
                className={`${CONTROL} ${CONTROL_H} w-full`}
              />
            </label>
            <label className="block min-w-0">
              <span className={FIELD_LABEL}>Teléfono / WhatsApp</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="55 1234 5678"
                type="tel"
                autoComplete="tel"
                data-testid="pub-phone"
                className={`${CONTROL} ${CONTROL_H} w-full`}
              />
            </label>
          </div>

          {error && (
            <Notice tone="danger" size="sm" className="mt-4" testId="pub-error">
              {error}
            </Notice>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedSlot || !phone.trim()}
            data-testid="pub-submit"
            className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-[color:var(--brand)] px-4 text-[16px] font-semibold text-[color:var(--on-brand)] shadow-[0_2px_10px_-2px_rgba(42,26,94,.35)] transition-[transform,opacity] duration-150 hover:opacity-95 focus-visible:outline-[color:var(--brand-ink)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none"
          >
            {submitting ? 'Reservando…' : 'Reservar cita'}
          </button>
          {!selectedSlot || !phone.trim() ? (
            <p className="mt-2 text-center text-[13px] text-ink-muted">
              {serviceIds.length === 0
                ? 'Elige un servicio y un horario para continuar.'
                : !selectedSlot
                  ? 'Elige un horario para continuar.'
                  : 'Escribe tu teléfono para continuar.'}
            </p>
          ) : null}
        </Step>
      </ol>
    </Card>
  )
}
