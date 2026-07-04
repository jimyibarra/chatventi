// Utilidades de fecha/hora conscientes de zona horaria, SIN dependencias.
// La agenda opera en la zona de la sucursal (branches.timezone); estas
// funciones convierten entre "hora de pared local" y el instante UTC real.

// Minutos que la zona `tz` está adelantada respecto a UTC en un instante dado.
function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second)
  return (asUtc - date.getTime()) / 60000
}

// Hora de pared local (y/mo/d/h/mi en `tz`) -> instante UTC.
export function zonedTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
  const off = tzOffsetMinutes(new Date(utcGuess), tz)
  return new Date(utcGuess - off * 60000)
}

// Rango UTC [inicio, fin) del día local `dateStr` (YYYY-MM-DD) en `tz`.
export function dayRangeUtc(dateStr: string, tz: string): { from: string; to: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const from = zonedTimeToUtc(y, m, d, 0, 0, tz)
  const to = zonedTimeToUtc(y, m, d + 1, 0, 0, tz)
  return { from: from.toISOString(), to: to.toISOString() }
}

// Rango UTC de la semana (lunes..lunes siguiente) que contiene `dateStr`.
export function weekRangeUtc(
  dateStr: string,
  tz: string
): { from: string; to: string; days: string[] } {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Día de la semana local (0=Dom..6=Sáb) para hallar el lunes.
  const noon = new Date(zonedTimeToUtc(y, m, d, 12, 0, tz))
  const shortName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(noon)
  const localDow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(shortName)
  const mondayOffset = (localDow + 6) % 7 // días desde el lunes
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const dayUtc = zonedTimeToUtc(y, m, d - mondayOffset + i, 12, 0, tz)
    days.push(ymdInTz(dayUtc, tz))
  }
  const from = zonedTimeToUtc(y, m, d - mondayOffset, 0, 0, tz)
  const to = zonedTimeToUtc(y, m, d - mondayOffset + 7, 0, 0, tz)
  return { from: from.toISOString(), to: to.toISOString(), days }
}

// YYYY-MM-DD de un instante en `tz`.
export function ymdInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  return `${map.year}-${map.month}-${map.day}`
}

// Minutos desde medianoche (hora local `tz`) de un instante ISO.
export function localMinutes(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value)
  return map.hour * 60 + map.minute
}

// "HH:MM" local.
export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

// Etiqueta larga de fecha local, p.ej. "lun 6 jul 2026".
export function formatDateLabel(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const noon = new Date(zonedTimeToUtc(y, m, d, 12, 0, tz))
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(noon)
}

// Suma días a un YYYY-MM-DD (en tz) y devuelve otro YYYY-MM-DD.
export function addDays(dateStr: string, delta: number, tz: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const noon = new Date(zonedTimeToUtc(y, m, d + delta, 12, 0, tz))
  return ymdInTz(noon, tz)
}
