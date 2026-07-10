import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createWebhookClient } from '@/lib/supabase/webhook'
import { createServiceClient } from '@/lib/supabase/service'
import { runAgent } from '@/features/agente-ia/agent'
import { handleIncomingMedia } from '@/features/agente-ia/media'
import {
  tgSendMessage,
  tgSendApproval,
  tgSendChoiceButtons,
  tgAnswerCallback,
  tgEditMessageText,
  sendToCustomerByChannel,
} from '@/features/agente-ia/senders'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// Shapes mínimos del update de Telegram que consumimos.
// ---------------------------------------------------------------------
const messageSchema = z.object({
  message_id: z.number(),
  chat: z.object({
    id: z.number(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  }),
  text: z.string().optional(),
  // Media (solo detectamos presencia: aviso + escalamiento, sin descargar).
  photo: z.array(z.object({ file_id: z.string() })).optional(),
  voice: z.object({ file_id: z.string() }).optional(),
  audio: z.object({ file_id: z.string() }).optional(),
  document: z.object({ file_id: z.string() }).optional(),
  video: z.object({ file_id: z.string() }).optional(),
})

/** Cuerpo del mensaje: texto o placeholder de media. */
function tgExtractBody(msg: z.infer<typeof messageSchema>): string | null {
  if (msg.text) return msg.text
  if (msg.photo?.length) return '[image]'
  if (msg.voice || msg.audio) return '[audio]'
  if (msg.document) return '[document]'
  if (msg.video) return '[video]'
  return null
}

function tgHasMedia(msg: z.infer<typeof messageSchema>): boolean {
  return Boolean(msg.photo?.length || msg.voice || msg.audio || msg.document || msg.video)
}

const callbackQuerySchema = z.object({
  id: z.string(),
  data: z.string().optional(),
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.number() }),
    })
    .optional(),
})

const updateSchema = z.object({
  update_id: z.number(),
  message: messageSchema.optional(),
  edited_message: messageSchema.optional(),
  callback_query: callbackQuerySchema.optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || secretHeader !== expected) {
    console.error('[telegram-webhook] secret token inválido')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let update: z.infer<typeof updateSchema>
  try {
    update = updateSchema.parse(await request.json())
  } catch (err) {
    console.error('[telegram-webhook] payload inválido', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // -------------------------------------------------------------------
  // A) Botón de aprobación pulsado (callback_query "appr:<id>:<1|0>")
  // -------------------------------------------------------------------
  if (update.callback_query) {
    const cb = update.callback_query

    // A.1) Botón de opción del CLIENTE pulsado ("say:<texto>"): entra al
    // historial como mensaje y dispara al agente (mismo flujo que texto).
    if ((cb.data ?? '').startsWith('say:')) {
      const choiceText = (cb.data ?? '').slice('say:'.length)
      const chatId = cb.message ? String(cb.message.chat.id) : null
      const channelExternalId = process.env.TELEGRAM_BOT_EXTERNAL_ID
      after(async () => {
        try {
          await tgAnswerCallback(cb.id, choiceText)
          if (!chatId || !channelExternalId || !choiceText) return
          const supabase = createWebhookClient()
          const { data, error } = await supabase.rpc('route_inbound_message', {
            p_channel_type: 'telegram',
            p_external_id: channelExternalId,
            p_from_handle: chatId,
            p_body: choiceText,
            p_media_path: null,
            p_ext_msg_id: `tg_cb_${cb.id}`,
          })
          if (error) {
            console.error('[telegram-webhook] route_inbound_message (say) error', error.message)
            return
          }
          const routed = data as { message_id: string | null; duplicate: boolean } | null
          // Reintento del proveedor o canal no hallado: no despertar al agente.
          if (!routed?.message_id || routed.duplicate) return
          await runAgent({
            channelType: 'telegram',
            externalId: channelExternalId,
            fromHandle: chatId,
            supabase,
            senders: {
              sendToCustomer: (text) => tgSendMessage(chatId, text),
              sendApproval: (approvalChatId, draft, approvalId) =>
                tgSendApproval(approvalChatId, draft, approvalId),
              sendButtons: (text, buttons) => tgSendChoiceButtons(chatId, text, buttons),
            },
          })
        } catch (err) {
          console.error('[telegram-webhook] error en callback say', err)
        }
      })
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    after(async () => {
      try {
        const parts = (cb.data ?? '').split(':')
        if (parts[0] !== 'appr' || parts.length < 3) return
        const approvalId = parts[1]
        const approved = parts[2] === '1'

        const service = createServiceClient()
        const { data, error } = await service.rpc('resolve_ai_approval', {
          p_approval_id: approvalId,
          p_approved: approved,
        })
        if (error) {
          await tgAnswerCallback(cb.id, 'No se pudo procesar.')
          return
        }
        const res = data as {
          already_resolved?: boolean
          approved?: boolean
          draft?: string
          conversation_id?: string
          channel_type?: string
          channel_external_id?: string
          send_to?: string
        }

        if (res?.already_resolved) {
          await tgAnswerCallback(cb.id, 'Ya estaba resuelta.')
          return
        }

        if (approved && res?.send_to && res.channel_type && res.channel_external_id && res.draft) {
          const extId = await sendToCustomerByChannel(
            service,
            res.channel_type,
            res.channel_external_id,
            res.send_to,
            res.draft
          )
          if (res.conversation_id) {
            await service.rpc('log_outbound_message', {
              p_conversation_id: res.conversation_id,
              p_body: res.draft,
              p_sender: 'ai',
              p_external_id: extId ?? undefined,
            })
          }
        }

        await tgAnswerCallback(cb.id, approved ? 'Enviado ✅' : 'Rechazado')
        if (cb.message) {
          await tgEditMessageText(
            String(cb.message.chat.id),
            cb.message.message_id,
            approved ? '✅ Aprobado y enviado al cliente.' : '✋ Rechazado. Un humano continuará.'
          )
        }
      } catch (err) {
        console.error('[telegram-webhook] error en callback', err)
      }
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // -------------------------------------------------------------------
  // B) Mensaje entrante de un cliente
  // -------------------------------------------------------------------
  const msg = update.message ?? update.edited_message
  if (!msg) return NextResponse.json({ ok: true }, { status: 200 })

  const channelExternalId = process.env.TELEGRAM_BOT_EXTERNAL_ID
  if (!channelExternalId) {
    console.error('[telegram-webhook] falta TELEGRAM_BOT_EXTERNAL_ID')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const fromHandle = String(msg.chat.id)

  // Solo despertar al agente si el mensaje se insertó de verdad (ni error,
  // ni reintento del proveedor con el mismo update, ni canal no hallado).
  let shouldHandle = false
  try {
    const supabase = createWebhookClient()
    const { data, error } = await supabase.rpc('route_inbound_message', {
      p_channel_type: 'telegram',
      p_external_id: channelExternalId,
      p_from_handle: fromHandle,
      p_body: tgExtractBody(msg),
      p_media_path: null,
      p_ext_msg_id: `tg_${update.update_id}_${msg.message_id}`,
    })
    if (error) {
      console.error('[telegram-webhook] route_inbound_message error', error.message)
    } else {
      const routed = data as { message_id: string | null; duplicate: boolean } | null
      shouldHandle = Boolean(routed?.message_id) && !routed?.duplicate
    }
  } catch (err) {
    console.error('[telegram-webhook] error procesando', err)
  }

  if (!shouldHandle) return NextResponse.json({ ok: true }, { status: 200 })

  // El agente (o el escalamiento de media) corre fuera del ciclo de la request.
  const isMedia = !msg.text && tgHasMedia(msg)
  after(async () => {
    try {
      const supabase = createWebhookClient()
      const senders = {
        sendToCustomer: (text: string) => tgSendMessage(fromHandle, text),
        sendApproval: (chatId: string, draft: string, approvalId: string) =>
          tgSendApproval(chatId, draft, approvalId),
        sendButtons: (text: string, buttons: { id: string; title: string }[]) =>
          tgSendChoiceButtons(fromHandle, text, buttons),
      }
      if (isMedia) {
        await handleIncomingMedia({
          channelType: 'telegram',
          externalId: channelExternalId,
          fromHandle,
          supabase,
          senders,
        })
      } else if (msg.text) {
        await runAgent({
          channelType: 'telegram',
          externalId: channelExternalId,
          fromHandle,
          supabase,
          senders,
        })
      }
    } catch (err) {
      console.error('[telegram-webhook] error del agente', err)
    }
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
