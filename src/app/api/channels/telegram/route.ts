import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createWebhookClient } from '@/lib/supabase/webhook'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// Shape minimo de un update de Telegram (Bot API) que consumimos.
// ---------------------------------------------------------------------
const messageSchema = z.object({
  message_id: z.number(),
  chat: z.object({
    id: z.number(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  }),
  text: z.string().optional(),
})

const updateSchema = z.object({
  update_id: z.number(),
  message: messageSchema.optional(),
  edited_message: messageSchema.optional(),
})

// ---------------------------------------------------------------------
// POST: recibe updates de Telegram. Valida el secret token del header.
// Responde SIEMPRE 200 para que Telegram no reintente en bucle.
// external_id del canal = id del bot (chat.id NO; el enrutado multi-tenant
// se hace por bot). Aqui el `channel.external_id` es el bot id; llega en el
// path? No: Telegram no envia el bot id en el update. Estrategia Fase 1:
// un webhook por bot con secret token unico -> resolvemos el canal por el
// secret. Ver TODO abajo.
// ---------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || secretHeader !== expected) {
    console.error('[telegram-webhook] secret token invalido')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let update: z.infer<typeof updateSchema>
  try {
    update = updateSchema.parse(await request.json())
  } catch (err) {
    console.error('[telegram-webhook] payload invalido', err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const msg = update.message ?? update.edited_message
  if (!msg) return NextResponse.json({ ok: true }, { status: 200 })

  // TODO(multi-bot): cuando haya varios bots Telegram, el `external_id` del
  // canal debe ser el bot id y el enrutado resolverse por bot. En Fase 1
  // (un bot global) usamos TELEGRAM_BOT_EXTERNAL_ID como external_id del canal.
  const channelExternalId = process.env.TELEGRAM_BOT_EXTERNAL_ID
  if (!channelExternalId) {
    console.error('[telegram-webhook] falta TELEGRAM_BOT_EXTERNAL_ID')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const supabase = createWebhookClient()
    // Dedup idempotente por update_id + message_id (unico por bot).
    const { error } = await supabase.rpc('route_inbound_message', {
      p_channel_type: 'telegram',
      p_external_id: channelExternalId,
      p_from_handle: String(msg.chat.id),
      p_body: msg.text ?? null,
      p_media_path: null,
      p_ext_msg_id: `tg_${update.update_id}_${msg.message_id}`,
    })
    if (error) {
      console.error('[telegram-webhook] route_inbound_message error', error.message)
    }
  } catch (err) {
    console.error('[telegram-webhook] error procesando', err)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
