// =====================================================================
// Webhook unificado de Meta para Instagram DM y Facebook Messenger.
//   El de WhatsApp (/api/webhooks/whatsapp) SE MANTIENE VIVO con su URL ya
//   registrada en Meta; este atiende los objects 'instagram' y 'page'.
//   Mismos invariantes: firma HMAC del body CRUDO (runtime nodejs), 200
//   SIEMPRE tras validar, trabajo pesado en after(). Texto en esta fase.
// =====================================================================
import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextResponse, type NextRequest } from 'next/server'
import { createWebhookClient } from '@/lib/supabase/webhook'
import { createServiceClient } from '@/lib/supabase/service'
import { runAgent } from '@/features/agente-ia/agent'
import {
  parseMetaMessaging,
  getChannelToken,
  metaSendText,
  type MetaInboundMessage,
} from '@/features/canales/meta-messaging'
import { tgSendApproval } from '@/features/agente-ia/senders'

export const runtime = 'nodejs'

// GET: verificación del webhook (hub.challenge), mismo token que WhatsApp.
export function GET(request: NextRequest): NextResponse {
  const params = request.nextUrl.searchParams
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (
    params.get('hub.mode') === 'subscribe' &&
    expected &&
    params.get('hub.verify_token') === expected &&
    params.get('hub.challenge')
  ) {
    return new NextResponse(params.get('hub.challenge'), { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function validSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const provided = Buffer.from(signatureHeader.slice('sha256='.length), 'hex')
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody).digest('hex'), 'hex')
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const rawBody = await request.text()
  if (!validSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const inbound = parseMetaMessaging(body)

  // 200 inmediato; el enrutado y el agente van en after() (evita reintentos).
  if (inbound.length > 0) {
    after(async () => {
      const supabase = createWebhookClient()
      const service = createServiceClient()
      for (const msg of inbound) {
        try {
          await handleInbound(msg, supabase, service)
        } catch (err) {
          console.error('[meta-webhook] error procesando mensaje', err)
        }
      }
    })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}

async function handleInbound(
  msg: MetaInboundMessage,
  supabase: ReturnType<typeof createWebhookClient>,
  service: ReturnType<typeof createServiceClient>
): Promise<void> {
  // Misma RPC que WhatsApp/Telegram: resuelve canal→org, crea client/
  // conversation/message y dedupea por external_id (reintentos de Meta).
  const { data, error } = await supabase.rpc('route_inbound_message', {
    p_channel_type: msg.channelType,
    p_external_id: msg.channelExternalId,
    p_from_handle: msg.senderId,
    p_body: msg.text,
    p_ext_msg_id: msg.externalMessageId ?? undefined,
  })
  if (error) {
    console.error('[meta-webhook] route_inbound_message error', error.message)
    return
  }
  const routed = data as { duplicate?: boolean } | null
  if (routed?.duplicate) return

  await runAgent({
    channelType: msg.channelType,
    externalId: msg.channelExternalId,
    fromHandle: msg.senderId,
    supabase,
    senders: {
      sendToCustomer: async (text) => {
        const token = await getChannelToken(service, msg.channelType, msg.channelExternalId)
        if (!token) return null
        return metaSendText(msg.channelExternalId, token, msg.senderId, text)
      },
      // La aprobación humana viaja por Telegram, como en todos los canales.
      sendApproval: (chatId, draft, approvalId) => tgSendApproval(chatId, draft, approvalId),
      sendButtons: async (text, buttons) => {
        const token = await getChannelToken(service, msg.channelType, msg.channelExternalId)
        if (!token) return null
        return metaSendText(msg.channelExternalId, token, msg.senderId, text, buttons)
      },
    },
  })
}
