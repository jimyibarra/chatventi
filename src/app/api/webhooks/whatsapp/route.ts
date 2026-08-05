import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createWebhookClient } from '@/lib/supabase/webhook'
import { createServiceClient } from '@/lib/supabase/service'
import { runAgent } from '@/features/agente-ia/agent'
import { handleIncomingMedia } from '@/features/agente-ia/media'
import { fetchWhatsAppMedia } from '@/features/agente-ia/media-fetch'
import {
  waSendMessage,
  waSendInteractiveButtons,
  getWaToken,
  tgSendApproval,
} from '@/features/agente-ia/senders'

// Meta exige firma HMAC-SHA256 sobre el body CRUDO -> runtime Node (no Edge).
export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// GET: verificacion del webhook (Meta -> hub.challenge)
// ---------------------------------------------------------------------
export function GET(request: NextRequest): NextResponse {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ---------------------------------------------------------------------
// Validacion del payload de WhatsApp Cloud API (shape minimo que usamos)
// ---------------------------------------------------------------------
const messageSchema = z.object({
  from: z.string(),
  id: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  // Pulsación de un reply button (mensajes interactivos).
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  image: z.object({ id: z.string() }).optional(),
  audio: z.object({ id: z.string() }).optional(),
  document: z.object({ id: z.string() }).optional(),
  video: z.object({ id: z.string() }).optional(),
})

const changeValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }).optional(),
  messages: z.array(messageSchema).optional(),
})

const payloadSchema = z.object({
  object: z.string().optional(),
  entry: z
    .array(
      z.object({
        changes: z
          .array(z.object({ value: changeValueSchema }))
          .optional(),
      })
    )
    .optional(),
})

// ---------------------------------------------------------------------
// Firma X-Hub-Signature-256 = 'sha256=' + HMAC_SHA256(appSecret, rawBody)
// ---------------------------------------------------------------------
function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const providedBuf = Buffer.from(provided, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

/** Id del binario en Graph, si el mensaje trae media que sepamos bajar. */
function mediaIdOf(msg: z.infer<typeof messageSchema>): string | null {
  return msg.image?.id ?? msg.audio?.id ?? msg.document?.id ?? msg.video?.id ?? null
}

/** Extrae el cuerpo de texto (o placeholder) segun el tipo de mensaje. */
function extractBody(msg: z.infer<typeof messageSchema>): string | null {
  if (msg.text) return msg.text.body
  // Reply button pulsado: el titulo entra al historial como texto del cliente.
  // Los botones de horario ("slot:<iso>") conservan el instante exacto en una
  // marca [slot:...] para que el agente no re-derive la hora (bug de tz).
  if (msg.interactive?.button_reply) {
    const { id, title } = msg.interactive.button_reply
    return id.startsWith('slot:') ? `${title} [${id}]` : title
  }
  // Media: el placeholder se mantiene como cuerpo del mensaje; el binario se
  // descarga aparte, tras el 200, y se ancla con attach_message_media.
  if (msg.image || msg.audio || msg.document || msg.video) return `[${msg.type}]`
  return null
}

// ---------------------------------------------------------------------
// POST: recibe mensajes. Responde SIEMPRE 200 (evita reintentos de Meta).
// ---------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[whatsapp-webhook] falta META_APP_SECRET')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    console.error('[whatsapp-webhook] firma invalida')
    // 200 para no filtrar informacion ni provocar reintentos.
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let parsed: z.infer<typeof payloadSchema>
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody))
  } catch (err) {
    console.error('[whatsapp-webhook] payload invalido', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // Mensajes de texto a responder por el agente (fuera del ciclo de la request).
  const toAnswer: { phoneNumberId: string; from: string }[] = []
  // Media entrante: descarga del binario + aviso estatico + escalamiento (sin LLM).
  // `messageId` es el que devuelve route_inbound_message: sin el, no hay a que
  // anclar el archivo.
  const mediaToEscalate: {
    phoneNumberId: string
    from: string
    mediaId: string | null
    messageId: string
  }[] = []
  // Boton "Confirmar asistencia" del recordatorio (id "conf:<appointment_id>"):
  // se confirma la cita SIN despertar al agente (respuesta estatica).
  const toConfirm: { phoneNumberId: string; from: string; appointmentId: string }[] = []

  try {
    const supabase = createWebhookClient()
    for (const entry of parsed.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value.metadata?.phone_number_id
        if (!phoneNumberId) continue
        for (const msg of change.value.messages ?? []) {
          const { data, error } = await supabase.rpc('route_inbound_message', {
            p_channel_type: 'whatsapp',
            p_external_id: phoneNumberId,
            p_from_handle: msg.from,
            p_body: extractBody(msg),
            p_media_path: null,
            p_ext_msg_id: msg.id,
          })
          const routed = data as { message_id: string | null; duplicate: boolean } | null
          const buttonId = msg.interactive?.button_reply?.id
          const confirmId =
            buttonId?.startsWith('conf:') &&
            z.string().uuid().safeParse(buttonId.slice(5)).success
              ? buttonId.slice(5)
              : null
          if (error) {
            console.error('[whatsapp-webhook] route_inbound_message error', error.message)
          } else if (!routed?.message_id || routed.duplicate) {
            // Canal no encontrado o reintento del proveedor (mismo wamid):
            // el mensaje ya está en BD; no despertar al agente otra vez.
          } else if (confirmId) {
            toConfirm.push({ phoneNumberId, from: msg.from, appointmentId: confirmId })
          } else if (msg.text || msg.interactive?.button_reply) {
            toAnswer.push({ phoneNumberId, from: msg.from })
          } else if (msg.image || msg.audio || msg.document || msg.video) {
            mediaToEscalate.push({
              phoneNumberId,
              from: msg.from,
              mediaId: mediaIdOf(msg),
              messageId: routed.message_id,
            })
          }
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] error procesando', err)
  }

  // Media: descarga del binario, aviso amable y escalamiento a humano, todo
  // tras el 200 y sin LLM. La descarga NO puede ir antes del ACK: Meta
  // reintenta si tardamos, y son dos llamadas a Graph.
  if (mediaToEscalate.length > 0) {
    after(async () => {
      const supabase = createWebhookClient()
      const service = createServiceClient()
      for (const { phoneNumberId, from, mediaId, messageId } of mediaToEscalate) {
        try {
          await handleIncomingMedia({
            channelType: 'whatsapp',
            externalId: phoneNumberId,
            fromHandle: from,
            supabase,
            media: mediaId
              ? {
                  messageId,
                  fetch: async () => {
                    const token = await getWaToken(service, phoneNumberId)
                    if (!token) return null
                    return fetchWhatsAppMedia(mediaId, token)
                  },
                }
              : undefined,
            senders: {
              sendToCustomer: async (text) => {
                const token = await getWaToken(service, phoneNumberId)
                if (!token) return null
                return waSendMessage(phoneNumberId, token, from, text)
              },
              sendApproval: (chatId, draft, approvalId) =>
                tgSendApproval(chatId, draft, approvalId),
            },
          })
        } catch (err) {
          console.error('[whatsapp-webhook] error escalando media', err)
        }
      }
    })
  }

  // Botón "Confirmar asistencia": confirma la cita y responde estático (sin LLM).
  if (toConfirm.length > 0) {
    after(async () => {
      const supabase = createWebhookClient()
      const service = createServiceClient()
      for (const { phoneNumberId, from, appointmentId } of toConfirm) {
        try {
          const { data, error } = await supabase.rpc('confirm_appointment_from_chat', {
            p_channel_type: 'whatsapp',
            p_external_id: phoneNumberId,
            p_client_phone: from,
            p_appointment_id: appointmentId,
          })
          const text = error
            ? 'Esta cita ya no se puede confirmar por aquí 🙏 Escríbenos y te ayudamos.'
            : '✅ ¡Gracias! Tu asistencia quedó confirmada. Te esperamos.'
          const token = await getWaToken(service, phoneNumberId)
          const extId = token ? await waSendMessage(phoneNumberId, token, from, text) : null
          const convId = (data as { conversation_id?: string } | null)?.conversation_id
          if (convId) {
            await supabase.rpc('log_outbound_message', {
              p_conversation_id: convId,
              p_body: text,
              p_sender: 'system',
              p_external_id: extId ?? undefined,
            })
          }
        } catch (err) {
          console.error('[whatsapp-webhook] error confirmando cita', err)
        }
      }
    })
  }

  // El agente IA responde tras devolver el 200 (evita timeouts/reintentos de Meta).
  if (toAnswer.length > 0) {
    after(async () => {
      const supabase = createWebhookClient()
      const service = createServiceClient()
      for (const { phoneNumberId, from } of toAnswer) {
        try {
          await runAgent({
            channelType: 'whatsapp',
            externalId: phoneNumberId,
            fromHandle: from,
            supabase,
            senders: {
              sendToCustomer: async (text) => {
                const token = await getWaToken(service, phoneNumberId)
                if (!token) return null
                return waSendMessage(phoneNumberId, token, from, text)
              },
              sendApproval: (chatId, draft, approvalId) =>
                tgSendApproval(chatId, draft, approvalId),
              sendButtons: async (text, buttons) => {
                const token = await getWaToken(service, phoneNumberId)
                if (!token) return null
                return waSendInteractiveButtons(phoneNumberId, token, from, text, buttons)
              },
            },
          })
        } catch (err) {
          console.error('[whatsapp-webhook] error del agente', err)
        }
      }
    })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
