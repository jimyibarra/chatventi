'use client'

import { useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setAppointmentStatus } from '@/features/agenda/actions'
import { setAgentEnabled } from '@/features/agente-ia/actions'
import { hhmm } from '../model'
import type { FeedItem, NextStop, Notice, PassedChat } from '../panel-data'
import '../lineas.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

const BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[13px] px-4 text-[15px] font-semibold transition-transform active:scale-95 disabled:opacity-60 md:min-h-[40px]'

function Train() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="5.5" y="3" width="13" height="14" rx="3.5" />
      <path d="M5.5 11h13M9 14h.01M15 14h.01M9 20.5l1.5-3.5M15 20.5 13.5 17" />
    </svg>
  )
}

/** Hook mínimo para los botones que cambian el estado de una cita. */
function useStatus() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  function run(appointmentId: string, status: 'confirmed' | 'completed') {
    setError('')
    setBusy(appointmentId)
    startTransition(async () => {
      const res = await setAppointmentStatus({ appointmentId, status })
      if (!res.ok) setError(res.error)
      else router.refresh()
      setBusy(null)
    })
  }
  return { run, error, busy: pending ? busy : null }
}

// ---------------------------------------------------------------------
// Próxima estación: una franja del color de cada profesional
// ---------------------------------------------------------------------
export function NextStations({ items, nowMin, agendaHref }: { items: NextStop[]; nowMin: number; agendaHref: string }) {
  const { run, error, busy } = useStatus()

  if (items.length === 0) {
    return (
      <div className="rounded-[20px] border-2 border-dashed border-line bg-white p-6 text-ink-muted">
        <p className="text-[17px] font-semibold text-ink">No quedan citas por atender hoy</p>
        <p className="mt-1 text-[15px]">Cuando la recepcionista o tú agenden una, aparece aquí con su hora.</p>
      </div>
    )
  }

  return (
    <div className="ln space-y-2">
      {items.map(({ line, station, from }, i) => {
        const live = station.state === 'now'
        const a = live ? station.start : from
        const b = live ? station.end : station.start
        const f = Math.min(1, Math.max(0, (nowMin - a) / Math.max(1, b - a)))
        const left = Math.max(0, b - nowMin)
        return (
          <article
            key={station.id}
            className="ln-in grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[20px] px-3.5 py-3 text-white md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:px-5 md:py-3.5"
            style={{ background: line.color, '--c': line.color, '--i': i, '--f': f } as Vars}
            data-testid="next-station"
          >
            <div className="grid min-w-[44px] justify-items-center gap-1 text-[13px] font-semibold leading-none">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[17px] font-bold" style={{ color: line.color }}>
                {line.n}
              </span>
              <span className="max-w-[72px] truncate" title={line.name}>{line.name.split(' ')[0]}</span>
            </div>
            <p className="text-[2.6rem] font-bold leading-[0.9] tracking-[-0.03em] md:text-[3.2rem]">{hhmm(station.start)}</p>
            <Link href={agendaHref} className="min-w-0 rounded-[10px] px-1 py-0.5 transition-colors hover:bg-black/15">
              <b className="block truncate text-[1.15rem] font-semibold leading-tight md:text-[1.3rem]">{station.client} ›</b>
              <span className="block truncate text-sm">
                {station.service}
                {live && ` · termina ${hhmm(station.end)}`}
              </span>
            </Link>
            <div className="col-span-3 flex md:order-none md:col-span-1 md:justify-end">
              {live && (
                <button
                  type="button"
                  onClick={() => run(station.id, 'completed')}
                  disabled={busy === station.id}
                  className={`${BTN} flex-1 bg-white text-ink md:flex-none`}
                >
                  {busy === station.id ? 'Guardando…' : 'Marcar atendida'}
                </button>
              )}
            </div>
            <div className="col-span-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 text-[13px] font-semibold leading-none md:col-span-4 md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]">
              <span className={`ln-chip order-last md:order-none ${live ? '' : 'bg-transparent text-white shadow-[inset_0_0_0_1.5px_#fff]'}`} data-st={live ? 'now' : undefined}>
                {live ? 'En curso' : 'Siguiente'}
              </span>
              <span>{hhmm(a)}</span>
              <span className="ln-meter">
                <i />
                <span className="ln-train"><Train /></span>
              </span>
              <span>{hhmm(b)}</span>
              <span className="order-last col-start-3 text-right md:order-none md:col-start-auto">
                {live ? `faltan ${left} min` : left >= 60 ? `llega en ${Math.floor(left / 60)} h ${left % 60} min` : `llega en ${left} min`}
              </span>
            </div>
          </article>
        )
      })}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Avisos: lo único del Panel que pide una acción tuya
// ---------------------------------------------------------------------
export function NoticesCard({ unconfirmed, chats }: { unconfirmed: Notice[]; chats: PassedChat[] }) {
  const { run, error, busy } = useStatus()
  const total = unconfirmed.length + chats.length

  return (
    <section className="rounded-[20px] bg-[#ffcd2e] p-4 text-ink md:p-5" aria-labelledby="avisos-h" data-testid="avisos">
      <h2 id="avisos-h" className="flex items-center gap-2 text-[1.15rem] font-bold">
        Avisos
        <b className="grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs font-bold text-white">{total}</b>
      </h2>

      {total === 0 && (
        <p className="mt-3 rounded-[14px] bg-white/70 p-3.5 text-[15px]">
          Todo al día: no hay citas por confirmar ni chats esperándote.
        </p>
      )}

      {unconfirmed.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-3 text-[13.5px] font-semibold">Citas sin confirmar</h3>
          <ul className="space-y-1.5">
            {unconfirmed.map((n) => (
              <li key={n.id} className="flex items-center gap-2.5 rounded-[14px] bg-white p-2.5">
                <span className="ln-badge" style={{ '--c': n.line.color } as Vars}>{n.line.n}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{n.time} · {n.client}</b>
                  <span className="block truncate text-[13px] text-ink-muted">{n.detail}</span>
                </span>
                <button
                  type="button"
                  onClick={() => run(n.id, 'confirmed')}
                  disabled={busy === n.id}
                  className={`${BTN} bg-brand-500 text-white hover:bg-brand-600`}
                  data-testid="confirmar-cita"
                >
                  {busy === n.id ? '…' : 'Confirmar'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {chats.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-4 text-[13.5px] font-semibold">Chats que te pasó la recepcionista</h3>
          <ul className="space-y-1.5">
            {chats.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 rounded-[14px] bg-white p-2.5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-brand-500 text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5V17h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{c.client}</b>
                  <span className="line-clamp-2 text-[13px] text-ink-muted">{c.draft || 'Espera tu respuesta'}</span>
                </span>
                <Link href={`/dashboard/conversaciones/${c.conversationId}`} className={`${BTN} border-2 border-ink bg-white text-ink hover:bg-brand-50`}>
                  Abrir chat
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
    </section>
  )
}

// ---------------------------------------------------------------------
// Recepcionista IA: qué hizo hoy, y el interruptor para pausarla
// ---------------------------------------------------------------------
const FEED_ICON: Record<FeedItem['kind'], { d: string; alt: boolean }> = {
  booked: { d: 'M8.5 3.5v4M15.5 3.5v4M12 10.5v6M9 13.5h6M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5z', alt: false },
  passed: { d: 'M3.5 12H14M10 7.5l4.5 4.5-4.5 4.5M19.5 5v14', alt: true },
  confirmed: { d: 'm5 12.5 4.5 4.5L19 7.5', alt: false },
}

export function IaCard({
  enabled,
  canToggle,
  respondidas,
  agendadas,
  pasados,
  mesCitas,
  mesImporte,
  feed,
}: {
  enabled: boolean
  canToggle: boolean
  respondidas: number
  agendadas: number
  pasados: number
  mesCitas: number
  mesImporte: number
  feed: FeedItem[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function toggle() {
    setError('')
    startTransition(async () => {
      const res = await setAgentEnabled(!enabled)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

  return (
    <section className="rounded-[20px] bg-ink p-4 text-white md:p-5" aria-labelledby="ia-h" data-testid="ia-card">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-brand-500" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="8" width="15" height="11" rx="3.5" />
            <path d="M12 8V4.5M9.5 12.5v2M14.5 12.5v2" />
          </svg>
        </span>
        <h2 id="ia-h" className="mr-auto text-[1.15rem] font-bold">Recepcionista IA</h2>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${enabled ? 'bg-[#4ade80] text-ink' : 'bg-white/20 text-white'}`}>
          {enabled ? 'Activa' : 'En pausa'}
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-[#eceaff]">
        Hoy respondió <b className="text-white">{plural(respondidas, 'mensaje', 'mensajes')}</b>, agendó{' '}
        <b className="text-white">{plural(agendadas, 'cita', 'citas')}</b> y te pasó{' '}
        <b className="text-white">{plural(pasados, 'chat', 'chats')}</b>.
      </p>
      {mesCitas > 0 && (
        <p className="mt-3 rounded-[14px] bg-white/10 px-3.5 py-2.5 text-[15px]" data-testid="ia-mes">
          Este mes lleva <b>{plural(mesCitas, 'cita agendada', 'citas agendadas')}</b>
          {mesImporte > 0 && (
            <>
              {' '}
              por <b className="text-[#ffcd2e]">${Math.round(mesImporte).toLocaleString('en-US')}</b> en servicios
            </>
          )}
          .
        </p>
      )}

      {feed.length > 0 ? (
        <ol className="mt-4">
          {feed.map((f, i) => (
            <li key={`${f.at}${i}`} className="relative grid grid-cols-[44px_28px_minmax(0,1fr)] gap-x-2.5 pb-4 last:pb-1">
              <time className="pt-1 text-[13px] font-semibold tabular-nums text-[#cfc9f5]">{f.time}</time>
              <span className={`relative z-[1] grid h-7 w-7 place-items-center rounded-[8px] ${FEED_ICON[f.kind].alt ? 'bg-[#ffcd2e] text-ink' : 'bg-brand-500 text-white'}`} aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={FEED_ICON[f.kind].d} />
                </svg>
              </span>
              {i < feed.length - 1 && <i className="absolute bottom-0 left-[67px] top-7 w-[3px] rounded bg-brand-500/60" aria-hidden />}
              <span className="min-w-0">
                <b className="block text-[15px] font-semibold leading-snug">{f.title}</b>
                <span className="block text-[13.5px] leading-snug text-[#dcd8f7]">{f.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-[14.5px] text-[#dcd8f7]">
          {enabled
            ? 'Hoy todavía no ha agendado ni te ha pasado ningún chat. En cuanto lo haga, lo verás aquí.'
            : 'Está en pausa: los mensajes que lleguen esperan a que alguien del equipo conteste.'}
        </p>
      )}

      {canToggle && (
        <button type="button" onClick={toggle} disabled={pending} className={`${BTN} mt-3 border-2 border-white text-white hover:bg-white/15`} data-testid="ia-toggle">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {enabled ? <path d="M9 6v12M15 6v12" /> : <path d="M8 5.5v13l10-6.5z" />}
          </svg>
          {pending ? 'Guardando…' : enabled ? 'Pausar la recepcionista' : 'Reanudar la recepcionista'}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-medium text-[#ffcd2e]">{error}</p>}
    </section>
  )
}
