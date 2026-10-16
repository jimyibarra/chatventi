import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import { brandForOrg, brandOrigin } from '@/features/marca/brand'
import { sendEmail } from '@/features/emails/mailer'
import { layout } from '@/features/emails/templates'
import { notifyOrgOwners } from '@/features/notifications/send'
import {
  OWNER_PAUSE_MINUTES,
  alertLevel,
  disconnectReason,
  parseEchoes,
  parseHistory,
  parseStateSync,
  type CoexMessage,
} from './parse'

// =====================================================================
// Coexistencia con la app WhatsApp Business (fases 2 a 4).
//
//   · Ecos: lo que el dueño escribe desde su app aparece en Chats y pausa a
//     la recepcionista 30 minutos en esa conversación.
//   · Historial y contactos: solo si el dueño los pide (botón en Conexiones,
//     primeras 24 h); se guardan los últimos 90 días.
//   · Alertas: días 7, 10 y 12 sin actividad de la app (Meta desconecta el
//     número a los ~14 días) y aviso inmediato si Meta lo desconecta. Por
//     correo, notificación en el panel/celular y webhook al socio. Nunca por
//     el propio número en riesgo.
// =====================================================================

type Service = SupabaseClient<Database>

export type CoexChange = { field: string; value: Record<string, unknown>; wabaId: string | null; phoneNumberId: string | null }

async function logMessage(service: Service, phoneNumberId: string, m: CoexMessage, origin: 'business_app' | 'history', pause: number) {
  const { error } = await service.rpc('log_coexistence_message', {
    p_phone_number_id: phoneNumberId,
    p_customer: m.customer,
    p_direction: m.direction,
    p_body: m.body,
    p_ext_id: m.extId ?? undefined,
    p_origin: origin,
    p_at: m.at?.toISOString(),
    p_pause_minutes: pause,
  })
  if (error) console.error('[coexistencia] log', origin, error.message)
}

async function touchActivity(service: Service, phoneNumberId: string) {
  await service
    .from('channels')
    .update({ app_activity_at: new Date().toISOString(), coexistence_alert_level: 0 })
    .eq('type', 'whatsapp')
    .eq('external_id', phoneNumberId)
}

/** Maneja un cambio del webhook de WhatsApp que no es `messages`. Nunca lanza. */
export async function handleCoexistenceChange(service: Service, c: CoexChange): Promise<void> {
  try {
    if (c.field === 'smb_message_echoes' && c.phoneNumberId) {
      for (const m of parseEchoes(c.value)) await logMessage(service, c.phoneNumberId, m, 'business_app', OWNER_PAUSE_MINUTES)
      return
    }
    if (c.field === 'history' && c.phoneNumberId) {
      const h = parseHistory(c.value)
      for (const m of h.messages) await logMessage(service, c.phoneNumberId, m, 'history', 0)
      await recordHistoryState(service, c.phoneNumberId, h.declined ? 'declined' : h.progress === 100 ? 'done' : 'importing', h.progress)
      await touchActivity(service, c.phoneNumberId)
      return
    }
    if (c.field === 'smb_app_state_sync' && c.phoneNumberId) {
      await applyContacts(service, c.phoneNumberId, parseStateSync(c.value))
      await touchActivity(service, c.phoneNumberId)
      return
    }
    const reason = disconnectReason(c.field, c.value)
    if (reason) await markDisconnected(service, { wabaId: c.wabaId, phoneNumberId: c.phoneNumberId, reason })
  } catch (err) {
    console.error('[coexistencia] cambio', c.field, err instanceof Error ? err.message : err)
  }
}

async function recordHistoryState(service: Service, phoneNumberId: string, state: string, progress: number | null) {
  const { data: ch } = await service.from('channels').select('id, credentials').eq('type', 'whatsapp').eq('external_id', phoneNumberId).maybeSingle()
  if (!ch) return
  const creds = (ch.credentials ?? {}) as Record<string, unknown>
  await service
    .from('channels')
    .update({ credentials: { ...creds, history_state: state, history_progress: progress, history_updated_at: new Date().toISOString() } as Json })
    .eq('id', ch.id)
}

/** Nombres de la libreta del dueño: solo rellenan clientes sin nombre; nunca pisan uno capturado en ChatVenti. */
async function applyContacts(service: Service, phoneNumberId: string, contacts: { phone: string; name: string | null; action: string }[]) {
  const { data: ch } = await service.from('channels').select('organization_id').eq('type', 'whatsapp').eq('external_id', phoneNumberId).maybeSingle()
  if (!ch) return
  for (const c of contacts) {
    if (c.action !== 'add' || !c.name) continue
    const { data: canonical } = await service.rpc('client_canonical', { p_channel_type: 'whatsapp', raw: c.phone })
    if (!canonical) continue
    await service.from('clients').update({ name: c.name.slice(0, 120) }).eq('organization_id', ch.organization_id).eq('phone_canonical', canonical as string).is('name', null)
  }
}

// ---------------------------------------------------------------------
// Desconexión y alertas
// ---------------------------------------------------------------------

type ChannelRow = { id: string; organization_id: string; external_id: string; display_name: string | null; created_at: string; app_activity_at: string | null; coexistence_alert_level: number; credentials: unknown }

async function markDisconnected(service: Service, o: { wabaId: string | null; phoneNumberId: string | null; reason: string }) {
  let q = service.from('channels').select('id, organization_id, external_id, display_name, created_at, app_activity_at, coexistence_alert_level, credentials').eq('type', 'whatsapp').is('disconnected_at', null)
  if (o.phoneNumberId) q = q.eq('external_id', o.phoneNumberId)
  else if (o.wabaId) q = q.eq('waba_id', o.wabaId)
  else return
  const { data } = await q
  for (const ch of (data ?? []) as ChannelRow[]) {
    await service.from('channels').update({ status: 'disabled', disconnected_at: new Date().toISOString(), disconnect_reason: o.reason }).eq('id', ch.id)
    await alertOwners(service, ch, 'disconnected', null)
  }
}

const NUMBER = (ch: ChannelRow) => ch.display_name ?? `el número ${ch.external_id}`

function alertCopy(kind: 'inactive' | 'disconnected', level: number | null, number: string) {
  if (kind === 'disconnected') {
    return {
      title: 'Meta desconectó tu WhatsApp',
      body: `Meta desconectó ${number} de tu recepcionista. Mientras no lo reconectes, no contesta ni salen recordatorios por WhatsApp. Reconéctalo desde Conexiones con «Conectar el número que ya uso en WhatsApp Business».`,
    }
  }
  const left = level === 3 ? 'unos 2 días' : level === 2 ? 'unos 4 días' : 'una semana'
  return {
    title: level === 3 ? 'Último aviso: abre tu WhatsApp Business' : 'Abre tu WhatsApp Business para no desconectar tu número',
    body: `No vemos actividad desde la app WhatsApp Business de ${number}. Meta desconecta el número de tu recepcionista si el celular pasa unos 14 días sin abrir la app: te quedan ${left}. Solo abre la app en ese celular; con eso basta. Si ya la abriste estos días, ignora este aviso.`,
  }
}

async function alertOwners(service: Service, ch: ChannelRow, kind: 'inactive' | 'disconnected', level: number | null) {
  const copy = alertCopy(kind, level, NUMBER(ch))
  const brand = await brandForOrg(ch.organization_id)
  const url = `${brandOrigin(brand)}/dashboard/conexiones`

  await notifyOrgOwners(ch.organization_id, { title: copy.title, body: copy.body, tag: 'whatsapp_coexistence', data: { url } }).catch(() => null)

  const { data: owners } = await service.from('profiles').select('email').eq('organization_id', ch.organization_id).eq('role', 'owner')
  for (const o of owners ?? []) {
    if (!o.email) continue
    await sendEmail({
      to: o.email,
      subject: copy.title,
      brand,
      html: layout({ title: copy.title, bodyHtml: `<p style="margin:0 0 14px">${copy.body}</p>`, cta: { label: 'Abrir Conexiones →', href: url }, brand }),
    }).catch(() => false)
  }

  await enqueuePartnerChannelEvent(service, ch.organization_id, kind === 'disconnected' ? 'channel.disconnected' : 'channel.inactive', {
    type: 'whatsapp',
    mode: 'coexistence',
    number: ch.display_name,
    level,
    daysIdle: level === 3 ? 12 : level === 2 ? 10 : level === 1 ? 7 : null,
    reason: kind === 'disconnected' ? 'meta_disconnected' : 'app_inactive',
  })
}

/** Aviso al socio del negocio, si tiene webhook. Lo despacha la corrida de cada 15 minutos. */
export async function enqueuePartnerChannelEvent(service: Service, orgId: string, event: string, payload: Record<string, unknown>) {
  const { data: org } = await service.from('organizations').select('partner_id').eq('id', orgId).maybeSingle()
  if (!org?.partner_id) return
  const { data: partner } = await service.from('partners').select('webhook_url, status').eq('id', org.partner_id).maybeSingle()
  if (!partner?.webhook_url || partner.status !== 'active') return
  await service.from('partner_webhook_deliveries').insert({ partner_id: org.partner_id, organization_id: orgId, event, payload: payload as Json })
}

/** Corrida diaria: días sin actividad de la app → alertas de los días 7, 10 y 12 (una vez por nivel). */
export async function runCoexistenceAlerts(service: Service, now = new Date()): Promise<{ checked: number; alerted: number }> {
  const { data } = await service
    .from('channels')
    .select('id, organization_id, external_id, display_name, created_at, app_activity_at, coexistence_alert_level, credentials')
    .eq('type', 'whatsapp')
    .eq('status', 'active')
    .is('disconnected_at', null)
    .eq('credentials->>mode', 'coexistence')
  let alerted = 0
  const rows = (data ?? []) as ChannelRow[]
  for (const ch of rows) {
    const creds = (ch.credentials ?? {}) as { obtained_at?: string }
    const since = Date.parse(ch.app_activity_at ?? creds.obtained_at ?? ch.created_at)
    const days = (now.getTime() - since) / 86_400_000
    const level = alertLevel(days)
    if (level > (ch.coexistence_alert_level ?? 0)) {
      await service.from('channels').update({ coexistence_alert_level: level }).eq('id', ch.id)
      await alertOwners(service, ch, 'inactive', level)
      alerted++
    }
  }
  return { checked: rows.length, alerted }
}
