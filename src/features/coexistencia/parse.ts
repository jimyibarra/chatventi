// Coexistencia con la app WhatsApp Business: lectura de los eventos de Meta y
// reglas puras (sin red ni base; se prueban con vitest). Formatos según la
// documentación de Meta (onboarding de usuarios de la app WhatsApp Business);
// los eventos crudos se guardan en meta_raw_events para confirmarlos con el
// primer número real.

export const OWNER_PAUSE_MINUTES = 30
export const HISTORY_MAX_DAYS = 90
/** Meta solo deja pedir historial y contactos en las primeras 24 h tras conectar. */
export const HISTORY_WINDOW_HOURS = 24

type Msg = {
  from?: string
  to?: string
  id?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: { caption?: string }
  video?: { caption?: string }
  document?: { caption?: string; filename?: string }
}

const LABEL: Record<string, string> = {
  image: '[imagen]',
  video: '[video]',
  audio: '[nota de voz]',
  voice: '[nota de voz]',
  document: '[documento]',
  sticker: '[sticker]',
  location: '[ubicación]',
  contacts: '[contacto]',
  reaction: '[reacción]',
}

/** Texto visible de un mensaje de WhatsApp; lo que no es texto se resume entre corchetes. */
export function messageText(m: Msg): string {
  if (m.text?.body) return m.text.body
  const caption = m.image?.caption ?? m.video?.caption ?? m.document?.caption
  const label = LABEL[m.type ?? ''] ?? (m.type ? `[${m.type}]` : '[mensaje]')
  return caption ? `${label} ${caption}` : label
}

const toDate = (ts: string | undefined): Date | null => {
  const n = Number(ts)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null
}

export type CoexMessage = {
  customer: string
  direction: 'inbound' | 'outbound'
  body: string
  extId: string | null
  at: Date | null
}

/** smb_message_echoes: lo que el dueño mandó desde su app. `to` es el cliente. */
export function parseEchoes(value: { message_echoes?: Msg[] } | null | undefined): CoexMessage[] {
  return (value?.message_echoes ?? [])
    .filter((m) => m.to)
    .map((m) => ({ customer: String(m.to), direction: 'outbound' as const, body: messageText(m), extId: m.id ?? null, at: toDate(m.timestamp) }))
}

type HistoryChunk = {
  metadata?: { phase?: number; chunk_order?: number; progress?: number }
  threads?: { id?: string; messages?: (Msg & { history_context?: { status?: string } })[] }[]
  errors?: { code?: number; title?: string; message?: string }[]
}

export type HistoryParse = { messages: CoexMessage[]; progress: number | null; declined: boolean; errors: number[] }

/**
 * history: hilos del dueño con sus clientes. Solo los últimos `maxDays` días.
 * Error 2593109 = el dueño no aceptó compartir su historial.
 */
export function parseHistory(
  value: { history?: HistoryChunk[] } | null | undefined,
  now = new Date(),
  maxDays = HISTORY_MAX_DAYS
): HistoryParse {
  const since = now.getTime() - maxDays * 86_400_000
  const out: HistoryParse = { messages: [], progress: null, declined: false, errors: [] }
  for (const chunk of value?.history ?? []) {
    if (typeof chunk.metadata?.progress === 'number') out.progress = chunk.metadata.progress
    for (const e of chunk.errors ?? []) {
      if (typeof e.code === 'number') out.errors.push(e.code)
      if (e.code === 2593109) out.declined = true
    }
    for (const t of chunk.threads ?? []) {
      const customer = t.id
      if (!customer) continue
      for (const m of t.messages ?? []) {
        const at = toDate(m.timestamp)
        if (!at || at.getTime() < since) continue
        out.messages.push({
          customer,
          direction: m.from === customer ? 'inbound' : 'outbound',
          body: messageText(m),
          extId: m.id ?? null,
          at,
        })
      }
    }
  }
  return out
}

export type ContactSync = { phone: string; name: string | null; action: 'add' | 'remove' }

/** smb_app_state_sync: contactos de la app (nombre y teléfono). */
export function parseStateSync(
  value: { state_sync?: { type?: string; action?: string; contact?: { full_name?: string; first_name?: string; phone_number?: string } }[] } | null | undefined
): ContactSync[] {
  return (value?.state_sync ?? [])
    .filter((s) => (s.type ?? 'contact') === 'contact' && s.contact?.phone_number)
    .map((s) => ({
      phone: String(s.contact?.phone_number).replace(/\D/g, ''),
      name: (s.contact?.full_name || s.contact?.first_name || '').trim() || null,
      action: s.action === 'remove' ? 'remove' : 'add',
    }))
}

// Eventos de account_update que significan que el número ya no está con ChatVenti.
const DISCONNECT_EVENTS = new Set(['PARTNER_REMOVED', 'ACCOUNT_OFFBOARDED', 'PARTNER_APP_UNINSTALLED', 'ACCOUNT_DELETED'])

/** account_update / account_offboarded → motivo de desconexión, o null si es otro aviso (verificación, nombre, etc.). */
export function disconnectReason(field: string, value: { event?: string } | null | undefined): string | null {
  if (field === 'account_offboarded') return 'ACCOUNT_OFFBOARDED'
  if (field !== 'account_update') return null
  const ev = String(value?.event ?? '').toUpperCase()
  return DISCONNECT_EVENTS.has(ev) ? ev : null
}

/** Nivel de alerta por días sin actividad de la app: 0 nada, 1 día 7, 2 día 10, 3 día 12. */
export function alertLevel(daysIdle: number): 0 | 1 | 2 | 3 {
  if (daysIdle >= 12) return 3
  if (daysIdle >= 10) return 2
  if (daysIdle >= 7) return 1
  return 0
}

/** ¿Sigue abierta la ventana de 24 h para pedir historial y contactos? */
export function historyWindowOpen(connectedAt: string | null | undefined, now = new Date()): boolean {
  const t = connectedAt ? Date.parse(connectedAt) : NaN
  return Number.isFinite(t) && now.getTime() - t < HISTORY_WINDOW_HOURS * 3_600_000
}
