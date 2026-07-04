import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const WA_GRAPH_VERSION = 'v21.0'

// -------------------------------------------------------------------
// Telegram (Bot API con TELEGRAM_BOT_TOKEN global)
// -------------------------------------------------------------------
export async function tgSendMessage(
  chatId: string,
  text: string,
  replyMarkup?: unknown
): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('[senders] falta TELEGRAM_BOT_TOKEN')
    return null
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
  const json = (await res.json().catch(() => null)) as
    | { ok: boolean; result?: { message_id: number } }
    | null
  if (!res.ok || !json?.ok) {
    console.error('[senders] tgSendMessage falló', await res.text().catch(() => ''))
    return null
  }
  return json.result ? String(json.result.message_id) : null
}

// Propuesta con botones Aprobar / Rechazar. callback_data = "appr:<id>:<1|0>".
export async function tgSendApproval(
  chatId: string,
  draft: string,
  approvalId: string
): Promise<void> {
  await tgSendMessage(chatId, `🤖 Propuesta de respuesta del asistente:\n\n"${draft}"`, {
    inline_keyboard: [
      [
        { text: '✅ Aprobar y enviar', callback_data: `appr:${approvalId}:1` },
        { text: '✋ Rechazar', callback_data: `appr:${approvalId}:0` },
      ],
    ],
  })
}

export async function tgAnswerCallback(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
  }).catch(() => null)
}

// Reemplaza el texto del mensaje de aprobación tras resolverlo (quita botones).
export async function tgEditMessageText(
  chatId: string,
  messageId: number,
  text: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
  }).catch(() => null)
}

// -------------------------------------------------------------------
// WhatsApp (Cloud API / Graph). Token por canal (channels.credentials).
// -------------------------------------------------------------------
export async function waSendMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string
): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/${WA_GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  )
  const json = (await res.json().catch(() => null)) as
    | { messages?: { id: string }[] }
    | null
  if (!res.ok) {
    console.error('[senders] waSendMessage falló', await res.text().catch(() => ''))
    return null
  }
  return json?.messages?.[0]?.id ?? null
}

// Lee el access_token del canal WhatsApp (secreto -> service client, bypassa RLS).
async function getWaToken(
  service: SupabaseClient<Database>,
  phoneNumberId: string
): Promise<string | null> {
  const { data } = await service
    .from('channels')
    .select('credentials')
    .eq('type', 'whatsapp')
    .eq('external_id', phoneNumberId)
    .maybeSingle()
  const creds = (data?.credentials ?? null) as { access_token?: string } | null
  return creds?.access_token ?? null
}

// -------------------------------------------------------------------
// Envío unificado al cliente según su canal (usado por el flujo de aprobación).
// -------------------------------------------------------------------
export async function sendToCustomerByChannel(
  service: SupabaseClient<Database>,
  channelType: string,
  channelExternalId: string,
  sendTo: string,
  text: string
): Promise<string | null> {
  if (channelType === 'telegram') {
    return tgSendMessage(sendTo, text)
  }
  if (channelType === 'whatsapp') {
    const token = await getWaToken(service, channelExternalId)
    if (!token) {
      console.error('[senders] sin access_token para el canal WhatsApp', channelExternalId)
      return null
    }
    return waSendMessage(channelExternalId, token, sendTo, text)
  }
  return null
}

export { getWaToken }
