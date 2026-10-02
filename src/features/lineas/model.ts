// =====================================================================
// Diseño «Líneas»: cada profesional es una línea de color y su día es el
// recorrido, como el plano del Metro. Las citas son estaciones.
//
// Este archivo es el MODELO, sin nada visual: convierte citas + horarios en
// líneas con estaciones, huecos libres y ventana de trabajo. Lo consumen el
// Panel y la Agenda, así ambos dibujan exactamente el mismo día.
// =====================================================================
import { localMinutes, ymdInTz } from '@/features/agenda/datetime'
import type { AppointmentView } from '@/features/agenda/types'

// Un color por profesional, en el orden en que aparecen. Todos aguantan texto
// blanco encima (contraste ≥ 4.5:1) porque se usan como fondo de franjas.
export const LINE_COLORS = [
  '#e0007a',
  '#0b5bd3',
  '#007a45',
  '#c2410c',
  '#0e7490',
  '#7c3aed',
  '#a16207',
  '#be123c',
] as const
const UNASSIGNED_COLOR = '#584d84'

export type StationState = 'wait' | 'ok' | 'now' | 'done' | 'noshow'

export const STATE_LABEL: Record<StationState, string> = {
  wait: 'Sin confirmar',
  ok: 'Confirmada',
  now: 'En curso',
  done: 'Atendida',
  noshow: 'No asistió',
}

export interface Station {
  id: string
  /** Minutos desde la medianoche local. */
  start: number
  end: number
  state: StationState
  client: string
  service: string
  appt: AppointmentView
}

export interface Gap {
  start: number
  end: number
}

export interface Line {
  /** null = citas sin profesional asignado. */
  id: string | null
  n: number
  name: string
  color: string
  stations: Station[]
  gaps: Gap[]
  /** Horario del profesional ese día; null si no trabaja o no lo ha configurado. */
  window: { start: number; end: number } | null
}

export interface DayModel {
  date: string
  lines: Line[]
  axis: { start: number; end: number }
  /** Minuto actual si `date` es hoy; null en cualquier otro día. */
  nowMin: number | null
}

export type ScheduleRow = { weekday: number; start_time: string; end_time: string }
export type ResourceInput = { id: string; name: string; schedules?: ScheduleRow[] }

const MIN_GAP = 30
const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function hhmm(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function durationLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`
}

function stateOf(a: AppointmentView, nowMs: number): StationState {
  if (a.status === 'completed') return 'done'
  if (a.status === 'no_show') return 'noshow'
  const started = new Date(a.starts_at).getTime() <= nowMs
  const ended = new Date(a.ends_at).getTime() <= nowMs
  if (started && !ended) return 'now'
  return a.status === 'confirmed' ? 'ok' : 'wait'
}

export function buildDay(input: {
  appointments: AppointmentView[]
  resources: ResourceInput[]
  tz: string
  /** YYYY-MM-DD en la zona del negocio. */
  date: string
  now?: Date
}): DayModel {
  const { tz, date } = input
  const now = input.now ?? new Date()
  const isToday = ymdInTz(now, tz) === date
  const nowMin = isToday ? localMinutes(now.toISOString(), tz) : null
  const [y, m, d] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()

  const dayAppts = input.appointments
    .filter((a) => a.status !== 'cancelled' && ymdInTz(new Date(a.starts_at), tz) === date)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const toStation = (a: AppointmentView): Station => {
    const start = localMinutes(a.starts_at, tz)
    const length = Math.max(15, Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000))
    return {
      id: a.id,
      start,
      end: start + length,
      state: stateOf(a, now.getTime()),
      client: a.client?.name || a.client?.phone || 'Cliente',
      service: a.services.map((s) => s.name).join(' + ') || 'Cita',
      appt: a,
    }
  }

  const lines: Line[] = input.resources.map((r, i) => {
    const today = (r.schedules ?? []).filter((s) => s.weekday === weekday)
    const window = today.length
      ? { start: Math.min(...today.map((s) => hm(s.start_time))), end: Math.max(...today.map((s) => hm(s.end_time))) }
      : null
    const stations = dayAppts.filter((a) => a.resource_id === r.id).map(toStation)

    // Huecos: tramos libres de al menos media hora dentro de su horario, y
    // solo de ahora en adelante (un hueco que ya pasó no se puede vender).
    const gaps: Gap[] = []
    if (window) {
      let cursor = Math.max(window.start, nowMin === null ? window.start : Math.ceil(nowMin / 15) * 15)
      for (const s of stations) {
        if (s.start - cursor >= MIN_GAP) gaps.push({ start: cursor, end: s.start })
        cursor = Math.max(cursor, s.end)
      }
      if (window.end - cursor >= MIN_GAP) gaps.push({ start: cursor, end: window.end })
    }
    return { id: r.id, n: i + 1, name: r.name, color: LINE_COLORS[i % LINE_COLORS.length], stations, gaps, window }
  })

  const orphan = dayAppts.filter((a) => a.resource_id === null || !input.resources.some((r) => r.id === a.resource_id))
  if (orphan.length > 0 || lines.length === 0) {
    lines.push({
      id: null,
      n: lines.length + 1,
      name: 'Sin asignar',
      color: UNASSIGNED_COLOR,
      stations: orphan.map(toStation),
      gaps: [],
      window: null,
    })
  }

  // Eje: de 9 a 19 por defecto, ensanchado a horas completas para que quepa todo.
  const points = lines.flatMap((l) => [
    ...(l.window ? [l.window.start, l.window.end] : []),
    ...l.stations.flatMap((s) => [s.start, s.end]),
  ])
  const axis = {
    start: Math.floor(Math.min(9 * 60, ...points) / 60) * 60,
    end: Math.ceil(Math.max(19 * 60, ...points) / 60) * 60,
  }
  return { date, lines, axis, nowMin }
}
