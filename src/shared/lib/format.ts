// Formatos de presentación del panel. México primero: miles con COMA (1,780).

const MX_TZ = 'America/Mexico_City'

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

/** "$1,250" o "$99.50" (con centavos, siempre dos: nunca "$105.5"). */
export function fmtMoney(n: number): string {
  const cents = !Number.isInteger(Math.round(n * 100) / 100)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** "2 oct 2026, 10:30" en la hora de México. */
export function fmtDateTime(iso: string, tz: string = MX_TZ): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz, hourCycle: 'h23' })
    .format(new Date(iso))
    .replace('.', '')
}

/** "10:30" en la hora de México. */
export function fmtTime(iso: string, tz: string = MX_TZ): string {
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso))
}

/** "2 oct" (con año si no es el actual). */
export function fmtShortDate(iso: string, tz: string = MX_TZ): string {
  const d = new Date(iso)
  const sameYear = new Date().getFullYear() === d.getFullYear()
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', timeZone: tz })
    .format(d)
    .replace('.', '')
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o la fecha corta. Para el servidor. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return fmtShortDate(iso)
}
