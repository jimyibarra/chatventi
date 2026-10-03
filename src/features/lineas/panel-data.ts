import { createClient } from '@/lib/supabase/server'
import { dayRangeUtc, formatTime, ymdInTz } from '@/features/agenda/datetime'
import { getAppointmentsRange } from '@/features/agenda/services'
import { getResources } from '@/features/profesionales/services'
import { AI_SOURCES } from '@/features/dashboard/ai-revenue'
import { buildDay, hhmm, type DayModel, type Line, type Station } from './model'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type NextStop = {
  line: Pick<Line, 'n' | 'name' | 'color'>
  station: Pick<Station, 'id' | 'start' | 'end' | 'state' | 'client' | 'service'>
  /** Desde dónde se mide el avance de la barra (fin de la cita anterior o 2 h antes). */
  from: number
}

export type Notice = { id: string; time: string; client: string; detail: string; line: Pick<Line, 'n' | 'color'> }
export type PassedChat = { id: string; conversationId: string; client: string; draft: string }
export type DepositNotice = {
  id: string
  client: string
  amount: number
  status: 'proof_received' | 'refund_due'
  when: string
  conversationId: string | null
}
export type FeedItem = { at: string; time: string; kind: 'booked' | 'passed' | 'confirmed'; title: string; detail: string }

export type PanelLineas = {
  tz: string
  day: DayModel
  next: NextStop[]
  unconfirmed: Notice[]
  chats: PassedChat[]
  deposits: DepositNotice[]
  feed: FeedItem[]
  /** Chats que la recepcionista pasó a una persona hoy. */
  passedToday: number
}

type ApprovalRow = {
  id: string
  created_at: string
  status: string
  draft: string | null
  conversation: { id: string; client: { name: string | null; phone: string | null } | null } | null
}

const who = (c: { name: string | null; phone: string | null } | null | undefined) => c?.name || c?.phone || 'Un cliente'

/** Todo lo que pinta el Panel «Líneas», de una sola pasada. null si no hay sucursal. */
export async function getPanelLineas(supabase: Supabase): Promise<PanelLineas | null> {
  const { data: branch } = await supabase.from('branches').select('id, timezone').order('created_at').limit(1).maybeSingle()
  if (!branch) return null
  const tz = branch.timezone ?? 'America/Mexico_City'
  const now = new Date()
  const today = ymdInTz(now, tz)
  const range = dayRangeUtc(today, tz)

  const [appointments, resources, approvals, aiBooked, confirmed, depositRows] = await Promise.all([
    getAppointmentsRange(supabase, branch.id, range.from, range.to),
    getResources(supabase),
    supabase
      .from('ai_approvals')
      .select('id, created_at, status, draft, conversation:conversations(id, client:clients(name, phone))')
      .or(`status.eq.pending,created_at.gte.${range.from}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('appointments')
      .select('id, created_at, starts_at, client:clients(name, phone), resource:resources(name), appointment_services(service:service_catalogs(name))')
      .in('source', AI_SOURCES)
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('appointments')
      .select('id, confirmed_by_client_at, starts_at, client:clients(name, phone)')
      .gte('confirmed_by_client_at', range.from)
      .lt('confirmed_by_client_at', range.to)
      .order('confirmed_by_client_at', { ascending: false })
      .limit(10),
    // Anticipos que piden una acción del negocio: revisar un comprobante o
    // devolver dinero. Sin filtro de fecha: no se pueden perder de vista.
    supabase
      .from('appointments')
      .select('id, starts_at, deposit_amount, deposit_status, client:clients(name, phone), proof:messages!appointments_deposit_proof_message_id_fkey(conversation_id)')
      .in('deposit_status', ['proof_received', 'refund_due'])
      .order('starts_at')
      .limit(6),
  ])

  const day = buildDay({
    appointments,
    resources: resources.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, schedules: r.schedules })),
    tz,
    date: today,
    now,
  })
  const nowMin = day.nowMin ?? 0

  // Próxima estación de cada línea: la que está en curso o, si no, la siguiente.
  const next: NextStop[] = []
  for (const line of day.lines) {
    const idx = line.stations.findIndex((s) => s.state === 'now')
    const i = idx >= 0 ? idx : line.stations.findIndex((s) => s.start > nowMin && (s.state === 'wait' || s.state === 'ok'))
    if (i < 0) continue
    const s = line.stations[i]
    const prevEnd = i > 0 ? line.stations[i - 1].end : s.start - 120
    next.push({
      line: { n: line.n, name: line.name, color: line.color },
      station: { id: s.id, start: s.start, end: s.end, state: s.state, client: s.client, service: s.service },
      from: Math.max(prevEnd, s.start - 120),
    })
  }
  next.sort((a, b) => a.station.start - b.station.start)

  const unconfirmed: Notice[] = day.lines
    .flatMap((line) =>
      line.stations
        .filter((s) => s.state === 'wait' && s.start > nowMin)
        .map((s) => ({ s, line }))
    )
    .sort((a, b) => a.s.start - b.s.start)
    .map(({ s, line }) => ({
      id: s.id,
      time: hhmm(s.start),
      client: s.client,
      detail: `${s.service}${line.id ? ` con ${line.name}` : ''}`,
      line: { n: line.n, color: line.color },
    }))

  const approvalRows = ((approvals.data ?? []) as unknown as ApprovalRow[]).filter((a) => a.conversation)
  const chats: PassedChat[] = approvalRows
    .filter((a) => a.status === 'pending')
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      conversationId: a.conversation!.id,
      client: who(a.conversation!.client),
      draft: (a.draft ?? '').slice(0, 110),
    }))
  const passedTodayRows = approvalRows.filter((a) => a.created_at >= range.from)

  type BookedRow = {
    id: string
    created_at: string
    starts_at: string
    client: { name: string | null; phone: string | null } | null
    resource: { name: string | null } | null
    appointment_services: { service: { name: string | null } | null }[] | null
  }
  type ConfirmedRow = { id: string; confirmed_by_client_at: string; starts_at: string; client: { name: string | null; phone: string | null } | null }
  const dayLabel = (iso: string) => {
    const d = ymdInTz(new Date(iso), tz)
    return d === today ? 'hoy' : new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
  }

  const feed: FeedItem[] = [
    ...((aiBooked.data ?? []) as unknown as BookedRow[]).map((a) => ({
      at: a.created_at,
      kind: 'booked' as const,
      title: `Agendó a ${who(a.client)}`,
      detail: `${a.appointment_services?.[0]?.service?.name ?? 'Cita'}, ${dayLabel(a.starts_at)} ${formatTime(a.starts_at, tz)}${a.resource?.name ? ` con ${a.resource.name}` : ''}`,
    })),
    ...passedTodayRows.map((a) => ({
      at: a.created_at,
      kind: 'passed' as const,
      title: `Te pasó a ${who(a.conversation!.client)}`,
      detail: a.status === 'pending' ? 'Espera tu visto bueno para responder' : 'Ya lo resolviste',
    })),
    ...((confirmed.data ?? []) as unknown as ConfirmedRow[]).map((a) => ({
      at: a.confirmed_by_client_at,
      kind: 'confirmed' as const,
      title: `${who(a.client)} confirmó su cita`,
      detail: `Respondió al recordatorio: viene ${dayLabel(a.starts_at)} a las ${formatTime(a.starts_at, tz)}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7)
    .map((f) => ({ ...f, time: formatTime(f.at, tz) }))

  type DepositRow = {
    id: string
    starts_at: string
    deposit_amount: number | string | null
    deposit_status: 'proof_received' | 'refund_due'
    client: { name: string | null; phone: string | null } | null
    proof: { conversation_id: string } | null
  }
  const deposits: DepositNotice[] = ((depositRows.data ?? []) as unknown as DepositRow[]).map((d) => ({
    id: d.id,
    client: who(d.client),
    amount: Number(d.deposit_amount ?? 0),
    status: d.deposit_status,
    when: `${dayLabel(d.starts_at)} ${formatTime(d.starts_at, tz)}`,
    conversationId: d.proof?.conversation_id ?? null,
  }))

  return { tz, day, next, unconfirmed, chats, deposits, feed, passedToday: passedTodayRows.length }
}
