// Membresías (fase 4, 17-oct-2026): fechas y estado. Lógica pura (se prueba sola).
// Las fechas son días calendario 'YYYY-MM-DD' (sin hora): una membresía vence
// al terminar su último día.

export type MembershipState = 'active' | 'expiring' | 'expired' | 'cancelled' | 'future'

/** Días que avisa antes de vencer (tablero y recordatorio). */
export const EXPIRING_DAYS = 7
export const REMINDER_DAYS_BEFORE = 3

const DAY = 86_400_000
const toTime = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`)
export const addDays = (ymd: string, days: number) => new Date(toTime(ymd) + days * DAY).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY)

/** Hoy en México como 'YYYY-MM-DD'. */
export function todayMx(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now)
}

export function membershipState(m: { starts_on: string; ends_on: string; cancelled: boolean }, today: string): MembershipState {
  if (m.cancelled) return 'cancelled'
  if (m.starts_on > today) return 'future'
  if (m.ends_on < today) return 'expired'
  return daysBetween(today, m.ends_on) <= EXPIRING_DAYS ? 'expiring' : 'active'
}

/** Último día de una membresía que empieza `start` y dura `days` (30 días desde el 1 → vence el 30). */
export const endsOn = (start: string, days: number) => addDays(start, days - 1)

/** Al renovar, empieza el día siguiente al vencimiento vigente; si ya venció, hoy. */
export function renewalStart(currentEnds: string | null, today: string): string {
  return currentEnds && currentEnds >= today ? addDays(currentEnds, 1) : today
}

export const STATE_LABEL: Record<MembershipState, string> = {
  active: 'Vigente',
  expiring: 'Por vencer',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  future: 'Empieza pronto',
}
