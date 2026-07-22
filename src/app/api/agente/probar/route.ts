import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runAgent } from '@/features/agente-ia/agent'

export const runtime = 'nodejs'

// Sandbox "Prueba el Chat IA en vivo" (/dashboard/agente/probar): el dueño
// conversa con SU propio agente usando el motor de producción, contra el
// contexto REAL de su org, pero con CERO efectos secundarios (ver runAgent
// sandbox:true — escrituras simuladas, sin aprobaciones/notificaciones).
const SANDBOX_CHANNEL_TYPE = 'web'
// Tope de mensajes por hilo (protege el saldo de OpenRouter). El botón
// "Reiniciar" limpia el hilo y reinicia el contador.
const MAX_MESSAGES_PER_THREAD = 25

const bodySchema = z.object({
  message: z.string().trim().min(1).max(400),
})

const LIMIT_REPLY =
  'Llegaste al límite de la prueba 😊 Toca "Reiniciar conversación" para empezar de nuevo. Cuando lo conectes, tu recepcionista atiende a tus clientes sin límite.'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { message } = parsed.data

  // 1. Sesión + organización del usuario (vía RLS, cliente autenticado).
  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const orgId = profile?.organization_id
  if (!orgId) return NextResponse.json({ error: 'sin_organizacion' }, { status: 400 })

  const externalId = `sandbox:${orgId}`
  const fromHandle = `sandbox:${user.id}`

  // 2. A partir de aquí, service_role: el motor y las RPCs (route_inbound_message,
  //    get_agent_context) están pensados para el webhook anon; aquí replicamos
  //    ese contexto de confianza acotado a la org ya verificada arriba.
  const admin = createServiceClient()

  // 2a. Canal sandbox de la org (idempotente por UNIQUE(type, external_id)).
  await admin
    .from('channels')
    .upsert(
      {
        organization_id: orgId,
        type: SANDBOX_CHANNEL_TYPE,
        external_id: externalId,
        status: 'active',
        display_name: 'Prueba interna',
      },
      { onConflict: 'type,external_id' }
    )

  // 2b. Tope durable por hilo (mensajes entrantes ya registrados).
  const { data: ctxCheck } = await admin.rpc('get_agent_context', {
    p_channel_type: SANDBOX_CHANNEL_TYPE,
    p_external_id: externalId,
    p_from_handle: fromHandle,
  })
  const priorInbound = ctxCheck
    ? ((ctxCheck as { messages?: { direction: string }[] }).messages ?? []).filter(
        (m) => m.direction === 'inbound'
      ).length
    : 0
  if (priorInbound >= MAX_MESSAGES_PER_THREAD) {
    return NextResponse.json({ reply: LIMIT_REPLY, limited: true, remaining: 0 })
  }

  // 3. Registrar el mensaje entrante y correr el agente en modo sandbox.
  const { data: routed, error: routeError } = await admin.rpc('route_inbound_message', {
    p_channel_type: SANDBOX_CHANNEL_TYPE,
    p_external_id: externalId,
    p_from_handle: fromHandle,
    p_body: message,
  })
  const routedInfo = routed as { message_id?: string | null } | string | null
  const ok =
    !routeError && (typeof routedInfo === 'string' ? routedInfo : routedInfo?.message_id)
  if (!ok) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const result = await runAgent({
    channelType: SANDBOX_CHANNEL_TYPE,
    externalId,
    fromHandle,
    supabase: admin,
    sandbox: true,
    senders: {
      sendToCustomer: async () => null,
      sendApproval: async () => undefined,
    },
  })

  if (!result.handled) {
    return NextResponse.json({
      reply:
        'No pude responder ahora mismo. Revisa que tu negocio tenga una sucursal y servicios configurados, y vuelve a intentar 🙏',
      reason: result.reason,
    })
  }

  return NextResponse.json({
    reply: result.reply,
    remaining: Math.max(0, MAX_MESSAGES_PER_THREAD - priorInbound - 1),
  })
}
