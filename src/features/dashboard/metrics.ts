import { createClient } from '@/lib/supabase/server'
import { addDays, dayRangeUtc, formatTime, ymdInTz } from '@/features/agenda/datetime'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type PanelMetrics = {
  tz: string
  citasHoy: { value: number; delta?: string; deltaTone: 'success' | 'warn'; spark: number[] }
  conversaciones: { value: number; delta?: string; deltaTone: 'success' | 'warn'; spark: number[] }
  /** null cuando no hay citas en el rango (la celda se omite). */
  confirmacion: { value: string; detail: string } | null
  clientesNuevos: number
  ia: { enabled: boolean; respondidas: number; agendadas: number; escaladas: number }
  proximas: { id: string; time: string; clientName: string; serviceName: string; confirmed: boolean }[]
}

type UpcomingRow = {
  id: string
  starts_at: string
  status: string
  client: { name: string | null } | null
  appointment_services: { service: { name: string | null } | null }[] | null
}

// Cuenta elementos por día local y devuelve el sparkline normalizado 0–1
// para la ventana de días dada (orden cronológico).
function sparkByDay(isoDates: string[], days: string[], tz: string): number[] {
  const counts = new Map<string, number>(days.map((d) => [d, 0]))
  for (const iso of isoDates) {
    const day = ymdInTz(new Date(iso), tz)
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const values = days.map((d) => counts.get(d) ?? 0)
  const max = Math.max(...values, 1)
  return values.map((v) => v / max)
}

export async function getPanelMetrics(supabase: Supabase): Promise<PanelMetrics> {
  const { data: branch } = await supabase.from('branches').select('timezone').limit(1).maybeSingle()
  const tz: string = branch?.timezone ?? 'America/Mexico_City'

  const now = new Date()
  const today = ymdInTz(now, tz)
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6, tz))
  const todayRange = dayRangeUtc(today, tz)
  const weekStart = dayRangeUtc(days[0], tz).from
  const prevWeekStart = dayRangeUtc(addDays(today, -13, tz), tz).from
  const monthStart = dayRangeUtc(addDays(today, -29, tz), tz).from

  const [
    apptWeek,
    convWeek,
    prevConvCount,
    confTotal,
    confOk,
    newClients,
    agentCfg,
    iaMsgs,
    iaAppts,
    iaApprovals,
    upcoming,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('starts_at')
      .gte('starts_at', weekStart)
      .lt('starts_at', todayRange.to)
      .not('status', 'in', '("cancelled","no_show")'),
    supabase.from('conversations').select('last_message_at').gte('last_message_at', weekStart),
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('last_message_at', prevWeekStart)
      .lt('last_message_at', weekStart),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('starts_at', monthStart)
      .lt('starts_at', todayRange.to),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('starts_at', monthStart)
      .lt('starts_at', todayRange.to)
      .in('status', ['confirmed', 'completed']),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart),
    supabase.from('agent_configs').select('enabled').maybeSingle(),
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'ai')
      .gte('created_at', todayRange.from)
      .lt('created_at', todayRange.to),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .in('source', ['whatsapp', 'telegram', 'ai'])
      .gte('created_at', todayRange.from)
      .lt('created_at', todayRange.to),
    supabase
      .from('ai_approvals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayRange.from)
      .lt('created_at', todayRange.to),
    supabase
      .from('appointments')
      .select(
        'id, starts_at, status, client:clients(name), appointment_services(service:service_catalogs(name))'
      )
      .gte('starts_at', now.toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('starts_at', { ascending: true })
      .limit(3),
  ])

  // --- Citas hoy + sparkline 7 días -----------------------------------------
  const apptDates: string[] = (apptWeek.data ?? []).map((r: { starts_at: string }) => r.starts_at)
  const apptPerDay = days.map(
    (d) => apptDates.filter((iso) => ymdInTz(new Date(iso), tz) === d).length
  )
  const citasHoy = apptPerDay[6]
  const citasAyer = apptPerDay[5]
  const citasDiff = citasHoy - citasAyer

  // --- Conversaciones con actividad esta semana + delta vs semana previa -----
  const convDates: string[] = (convWeek.data ?? [])
    .map((r: { last_message_at: string | null }) => r.last_message_at)
    .filter((v: string | null): v is string => Boolean(v))
  const convCount = convDates.length
  const prevConv = prevConvCount.count ?? 0
  const convPct = prevConv > 0 ? Math.round(((convCount - prevConv) / prevConv) * 100) : null

  // --- % de confirmación (últimos 30 días) -----------------------------------
  const total = confTotal.count ?? 0
  const ok = confOk.count ?? 0

  // --- Próximas citas ---------------------------------------------------------
  const proximas = ((upcoming.data ?? []) as unknown as UpcomingRow[]).map((a) => ({
    id: a.id,
    time: formatTime(a.starts_at, tz),
    clientName: a.client?.name ?? 'Cliente',
    serviceName: a.appointment_services?.[0]?.service?.name ?? 'Cita',
    confirmed: a.status === 'confirmed',
  }))

  return {
    tz,
    citasHoy: {
      value: citasHoy,
      delta:
        citasDiff === 0 ? '— igual que ayer' : `${citasDiff > 0 ? '▲' : '▼'} ${Math.abs(citasDiff)} vs ayer`,
      deltaTone: citasDiff >= 0 ? 'success' : 'warn',
      spark: sparkByDay(apptDates, days, tz),
    },
    conversaciones: {
      value: convCount,
      delta:
        convPct === null
          ? undefined
          : convPct === 0
            ? '— estable'
            : `${convPct > 0 ? '▲' : '▼'} ${Math.abs(convPct)}% semana`,
      deltaTone: convPct !== null && convPct < 0 ? 'warn' : 'success',
      spark: sparkByDay(convDates, days, tz),
    },
    confirmacion:
      total > 0
        ? { value: `${Math.round((ok / total) * 100)}%`, detail: `${ok} de ${total} · 30 días` }
        : null,
    clientesNuevos: newClients.count ?? 0,
    ia: {
      enabled: Boolean(agentCfg.data?.enabled),
      respondidas: iaMsgs.count ?? 0,
      agendadas: iaAppts.count ?? 0,
      escaladas: iaApprovals.count ?? 0,
    },
    proximas,
  }
}
