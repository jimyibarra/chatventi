import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { notifyOrgOwners } from '@/features/notifications/send'
import { uploadInboundMedia } from '@/features/storage/inbound'
import { runAgent } from './agent'
import { readImage } from './vision'
import { transcribeAudio } from './transcribe'
import type { FetchedMedia } from './media-fetch'
import type { AgentContext, AgentSenders } from './types'

type AnyClient = SupabaseClient<Database>

// Aviso estático al cliente cuando manda media (imagen/audio/documento/video).
// Se decide en el webhook SIN invocar al LLM: respuesta amable + escalamiento.
const MEDIA_REPLY =
  'Recibí tu archivo 📎 Por ahora no puedo revisar imágenes ni audios, pero ya avisé a una persona del equipo para que te atienda en breve 🙏'

// Borrador que el humano puede aprobar (se envía al cliente tal cual).
const MEDIA_DRAFT =
  'Hola 👋 Soy parte del equipo, ya vi el archivo que enviaste. ¿Me cuentas en qué te puedo ayudar?'

/**
 * Cómo bajar el binario de este mensaje. Es un callback y no los datos del
 * proveedor a propósito: WhatsApp y Telegram necesitan tokens y llamadas
 * distintas, y ese detalle vive en el webhook (mismo criterio que `senders`).
 */
export type IncomingMediaSource = {
  /** Mensaje ya insertado por route_inbound_message al que anclar el archivo. */
  messageId: string
  fetch: () => Promise<FetchedMedia | null>
}

/**
 * Descarga el binario, lo guarda en el bucket privado y lo ancla al mensaje.
 * Best-effort: si algo falla, la conversación sigue su curso con el aviso de
 * siempre. Devuelve lo descargado (para poder leerlo sin bajarlo dos veces),
 * o null.
 */
async function ingestMedia(params: {
  supabase: AnyClient
  orgId: string
  conversationId: string
  source: IncomingMediaSource
}): Promise<FetchedMedia | null> {
  const { supabase, orgId, conversationId, source } = params

  const fetched = await source.fetch()
  if (!fetched) return null

  const uploaded = await uploadInboundMedia({
    orgId,
    conversationId,
    bytes: fetched.bytes,
    mime: fetched.mime,
  })
  if (!uploaded) return null

  // La RPC solo ancla mensajes entrantes sin archivo y exige que la ruta
  // viva bajo la org dueña: un reintento del proveedor no sobrescribe.
  const { data, error } = await supabase.rpc('attach_message_media', {
    p_message_id: source.messageId,
    p_media_path: uploaded.path,
    p_media_mime: uploaded.mime,
  })
  if (error || data !== true) {
    console.error('[media] attach_message_media no ancló', error?.message ?? data)
    return null
  }
  // Se devuelve el MIME normalizado por el upload, no el que dijo el
  // proveedor: es el que quedó guardado.
  return { bytes: fetched.bytes, mime: uploaded.mime }
}

/**
 * Lee el archivo con la capacidad que corresponda a su tipo. Devuelve el
 * texto, o null si la capacidad está apagada, el tipo no se sabe leer o el
 * proveedor falla — en cualquiera de esos casos quien llama vuelve al aviso
 * + escalamiento de siempre, que es el comportamiento anterior a esta fase.
 */
async function readMedia(params: {
  fetched: FetchedMedia
  caps: { vision: boolean; transcribe: boolean }
}): Promise<string | null> {
  const { fetched, caps } = params
  if (fetched.mime.startsWith('image/')) {
    return caps.vision ? readImage(fetched.bytes, fetched.mime) : null
  }
  if (fetched.mime.startsWith('audio/')) {
    return caps.transcribe ? transcribeAudio(fetched.bytes, fetched.mime) : null
  }
  // PDF y cualquier otro tipo: no se lee todavía.
  return null
}

/**
 * Maneja media entrante en tres tramos:
 *
 *   1. GUARDA el archivo. Ocurre ANTES de la guarda `should_respond` a
 *      propósito: con la IA pausada no hay que mandar avisos, pero el
 *      archivo sí debe quedar en la conversación para quien atienda.
 *   2. Si la capacidad está encendida, LO LEE (visión o transcripción), lo
 *      guarda en `messages.media_text` —que viaja en el historial del
 *      agente— y deja que el agente responda a su contenido.
 *   3. Si no se pudo leer, vuelve el comportamiento de siempre: aviso
 *      amable + escalamiento a una persona.
 */
export async function handleIncomingMedia(params: {
  channelType: 'whatsapp' | 'telegram'
  externalId: string
  fromHandle: string
  supabase: AnyClient
  senders: AgentSenders
  media?: IncomingMediaSource
}): Promise<void> {
  const { channelType, externalId, fromHandle, supabase, senders, media } = params

  const { data: ctxData, error } = await supabase.rpc('get_agent_context', {
    p_channel_type: channelType,
    p_external_id: externalId,
    p_from_handle: fromHandle,
  })
  if (error || !ctxData) return

  const ctx = ctxData as unknown as AgentContext
  const convId = ctx.conversation?.id
  if (!convId) return

  const fetched = media
    ? await ingestMedia({ supabase, orgId: ctx.org_id, conversationId: convId, source: media })
    : null

  if (!ctx.conversation?.should_respond) return

  // Leer cuesta tokens, así que solo se intenta cuando la IA iba a responder
  // de todos modos (ya pasada la guarda de arriba).
  if (media && fetched) {
    const caps = {
      vision: ctx.config?.cap_vision === true,
      transcribe: ctx.config?.cap_transcribe === true,
    }
    if (caps.vision || caps.transcribe) {
      const text = await readMedia({ fetched, caps })
      if (text) {
        const { data: saved } = await supabase.rpc('set_message_media_text', {
          p_message_id: media.messageId,
          p_text: text,
        })
        if (saved === true) {
          // El agente lee `media_text` del historial (get_agent_context) y
          // responde al CONTENIDO del archivo. No se le pasa como tool:
          // runAgent corre con stopWhen: stepCountIs(6) y una tool de lectura
          // podría agotar los pasos a mitad de un agendamiento.
          const result = await runAgent({
            channelType,
            externalId,
            fromHandle,
            supabase,
            senders,
          })
          if (result.handled) return
          // Si el agente no pudo, cae al aviso + escalamiento de abajo.
        }
      }
    }
  }

  const extId = await senders.sendToCustomer(MEDIA_REPLY)
  await supabase.rpc('log_outbound_message', {
    p_conversation_id: convId,
    p_body: MEDIA_REPLY,
    p_sender: 'system',
    p_external_id: extId ?? undefined,
  })

  const { data: appr } = await supabase.rpc('create_ai_approval', {
    p_conversation_id: convId,
    p_draft: MEDIA_DRAFT,
    p_action: null,
  })
  const info = appr as { approval_id?: string; approval_chat_id?: string } | null
  if (info?.approval_chat_id && info.approval_id) {
    await senders.sendApproval(info.approval_chat_id, MEDIA_DRAFT, info.approval_id)
  }

  await notifyOrgOwners(ctx.org_id, {
    title: 'Un cliente envió un archivo 📎',
    body: 'La conversación quedó escalada para atención humana.',
    tag: 'escalation',
    data: { url: `/dashboard/conversaciones/${convId}` },
  })
}
