import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createWebhookClient } from '@/lib/supabase/webhook'
import { runAgent } from '@/features/agente-ia/agent'

export const runtime = 'nodejs'

// Demo del chat IA en la landing (Ola 3 Fase C): conversa con la org demo
// "Estética Demo ChatVenti" usando el agente REAL. Aislada del resto y con
// topes duros para proteger el saldo de OpenRouter.
const DEMO_CHANNEL_TYPE = 'web'
const DEMO_CHANNEL_EXTERNAL_ID = 'demo-landing'
// Máx mensajes del visitante por sesión (tope durable, contado en BD).
const MAX_MESSAGES_PER_SESSION = 8
// Rate limit por IP (mejor esfuerzo, en memoria por instancia).
const MAX_PER_IP_PER_HOUR = 30
const ipHits = new Map<string, { count: number; resetAt: number }>()

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(280),
})

function ipLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  entry.count++
  return entry.count > MAX_PER_IP_PER_HOUR
}

const LIMIT_REPLY =
  'Hasta aquí llega la demo 😊 Para atender a TUS clientes sin límite, crea tu cuenta gratis — tu recepcionista queda listo en minutos.'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { sessionId, message } = parsed.data

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (ipLimited(ip)) {
    return NextResponse.json({ reply: LIMIT_REPLY, limited: true })
  }

  const supabase = createWebhookClient()
  const fromHandle = `demo:${sessionId}`

  // Tope durable por sesión: mensajes entrantes ya registrados en la conversación.
  const { data: ctxCheck } = await supabase.rpc('get_agent_context', {
    p_channel_type: DEMO_CHANNEL_TYPE,
    p_external_id: DEMO_CHANNEL_EXTERNAL_ID,
    p_from_handle: fromHandle,
  })
  const priorInbound = ctxCheck
    ? ((ctxCheck as { messages?: { direction: string }[] }).messages ?? []).filter(
        (m) => m.direction === 'inbound'
      ).length
    : 0
  if (priorInbound >= MAX_MESSAGES_PER_SESSION) {
    return NextResponse.json({ reply: LIMIT_REPLY, limited: true })
  }

  const { data: routed, error: routeError } = await supabase.rpc('route_inbound_message', {
    p_channel_type: DEMO_CHANNEL_TYPE,
    p_external_id: DEMO_CHANNEL_EXTERNAL_ID,
    p_from_handle: fromHandle,
    p_body: message,
  })
  const routedInfo = routed as { message_id: string | null } | null
  if (routeError || !routedInfo?.message_id) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  // El agente corre igual que en WhatsApp/Telegram; la respuesta viaja por
  // HTTP (senders no-op) y queda registrada en la conversación demo.
  const result = await runAgent({
    channelType: DEMO_CHANNEL_TYPE,
    externalId: DEMO_CHANNEL_EXTERNAL_ID,
    fromHandle,
    supabase,
    senders: {
      sendToCustomer: async () => null,
      sendApproval: async () => undefined,
    },
  })

  if (!result.handled) {
    return NextResponse.json({
      reply: 'Dame un segundo… ¿me repites tu mensaje? 🙏',
    })
  }

  return NextResponse.json({
    reply: result.reply,
    remaining: Math.max(0, MAX_MESSAGES_PER_SESSION - priorInbound - 1),
  })
}
