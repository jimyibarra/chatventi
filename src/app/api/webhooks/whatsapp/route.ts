import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createWebhookClient } from '@/lib/supabase/webhook'
import { createServiceClient } from '@/lib/supabase/service'
import { runAgent } from '@/features/agente-ia/agent'
import { handleIncomingMedia } from '@/features/agente-ia/media'
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

/** Extrae el cuerpo de texto (o placeholder) segun el tipo de mensaje. */
function extractBody(msg: z.infer<typeof messageSchema>): string | null {
  if (msg.text) return msg.text.body
  // Reply button pulsado: el titulo entra al historial como texto del cliente.
  if (msg.interactive?.button_reply) return msg.interactive.button_reply.title
  // Media: en Fase 1 no descargamos el binario (proxy firmado se porta en su fase).
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
  // Media entrante: aviso estatico + escalamiento a humano (sin LLM).
  const mediaToEscalate: { phoneNumberId: string; from: string }[] = []

  try {
    const supabase = createWebhookClient()
    for (const entry of parsed.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value.metadata?.phone_number_id
        if (!phoneNumberId) continue
        for (const msg of change.value.messages ?? []) {
          const { error } = await supabase.rpc('route_inbound_message', {
            p_channel_type: 'whatsapp',
            p_external_id: phoneNumberId,
            p_from_handle: msg.from,
            p_body: extractBody(msg),
            p_media_path: null,
            p_ext_msg_id: msg.id,
          })
          if (error) {
            console.error('[whatsapp-webhook] route_inbound_message error', error.message)
          } else if (msg.text || msg.interactive?.button_reply) {
            toAnswer.push({ phoneNumberId, from: msg.from })
          } else if (msg.image || msg.audio || msg.document || msg.video) {
            mediaToEscalate.push({ phoneNumberId, from: msg.from })
          }
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] error procesando', err)
  }

  // Media: aviso amable + escalamiento a humano, tras el 200 y sin LLM.
  if (mediaToEscalate.length > 0) {
    after(async () => {
      const supabase = createWebhookClient()
      const service = createServiceClient()
      for (const { phoneNumberId, from } of mediaToEscalate) {
        try {
          await handleIncomingMedia({
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
            },
          })
        } catch (err) {
          console.error('[whatsapp-webhook] error escalando media', err)
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
