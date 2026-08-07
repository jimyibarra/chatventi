// =====================================================================
// ChatVenti · Canales Meta: Instagram DM + Facebook Messenger
//   La Send API es LA MISMA para ambos: POST /{page_or_ig_id}/messages con
//   recipient.id (PSID/IGSID) y el Page token guardado en channels.credentials.
//   Alcance de esta primera fase: TEXTO y quick replies. Media después.
// =====================================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const GRAPH_VERSION = 'v23.0'

/** Token de un canal por (type, external_id): channels.credentials.access_token. */
export async function getChannelToken(
  service: SupabaseClient<Database>,
  type: 'instagram' | 'messenger',
  externalId: string
): Promise<string | null> {
  const { data } = await service
    .from('channels')
    .select('credentials')
    .eq('type', type)
    .eq('external_id', externalId)
    .maybeSingle()
  const creds = data?.credentials as { access_token?: string } | null
  return creds?.access_token ?? null
}

/**
 * Envía texto (con quick replies opcionales) por Messenger o Instagram.
 * `channelExternalId` es el Page ID (Messenger) o el IG Business ID.
 * Devuelve el message_id de Meta o null.
 */
export async function metaSendText(
  channelExternalId: string,
  token: string,
  recipientId: string,
  text: string,
  buttons?: { id: string; title: string }[]
): Promise<string | null> {
  const message: Record<string, unknown> = { text }
  if (buttons?.length) {
    // Quick replies: el payload vuelve en messaging[].message.quick_reply.payload,
    // que el webhook trata como texto entrante (mismo patrón que Telegram).
    message.quick_replies = buttons.slice(0, 13).map((b) => ({
      content_type: 'text',
      title: b.title.slice(0, 20),
      payload: b.id.slice(0, 1000),
    }))
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${channelExternalId}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message,
      }),
    }
  )
  const json = (await res.json().catch(() => null)) as { message_id?: string; error?: unknown } | null
  if (!res.ok) {
    console.error('[meta-messaging] error enviando', channelExternalId, JSON.stringify(json?.error ?? res.status))
    return null
  }
  return json?.message_id ?? null
}

/** Un mensaje entrante de entry[].messaging[] ya aplanado. */
export interface MetaInboundMessage {
  channelType: 'instagram' | 'messenger'
  /** Page ID o IG Business ID: identifica el canal (entry.id). */
  channelExternalId: string
  /** PSID/IGSID del remitente. */
  senderId: string
  text: string
  /** mid de Meta, para dedup idempotente. */
  externalMessageId: string | null
}

/**
 * Aplana un payload de webhook de Messenger/Instagram (`object`: 'page' |
 * 'instagram') a mensajes entrantes de texto. Ignora ecos (mensajes que
 * enviamos nosotros), entregas, lecturas y adjuntos (fase posterior).
 */
export function parseMetaMessaging(body: unknown): MetaInboundMessage[] {
  const out: MetaInboundMessage[] = []
  const b = body as {
    object?: string
    entry?: {
      id?: string
      messaging?: {
        sender?: { id?: string }
        message?: {
          mid?: string
          text?: string
          is_echo?: boolean
          quick_reply?: { payload?: string }
        }
      }[]
    }[]
  }
  const channelType = b?.object === 'instagram' ? 'instagram' : b?.object === 'page' ? 'messenger' : null
  if (!channelType || !Array.isArray(b.entry)) return out

  for (const entry of b.entry) {
    if (!entry?.id || !Array.isArray(entry.messaging)) continue
    for (const ev of entry.messaging) {
      const msg = ev?.message
      if (!msg || msg.is_echo) continue
      // El payload de un quick reply manda sobre el texto visible del botón:
      // es el id que esperan los manejadores (conf:/csat:/slot:).
      const text = msg.quick_reply?.payload ?? msg.text
      if (!text || !ev.sender?.id) continue
      out.push({
        channelType,
        channelExternalId: entry.id,
        senderId: ev.sender.id,
        text,
        externalMessageId: msg.mid ?? null,
      })
    }
  }
  return out
}
