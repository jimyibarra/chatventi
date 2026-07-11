import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { notifyOrgOwners } from '@/features/notifications/send'
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
 * Maneja media entrante: aviso estático al cliente + escalamiento a humano
 * (create_ai_approval deja la conversación `pending` y la IA en pausa).
 * Respeta should_respond: si la IA está apagada/pausada o ya hay una
 * aprobación pendiente, no hace nada (evita avisos duplicados).
 */
export async function handleIncomingMedia(params: {
  channelType: 'whatsapp' | 'telegram'
  externalId: string
  fromHandle: string
  supabase: AnyClient
  senders: AgentSenders
}): Promise<void> {
  const { channelType, externalId, fromHandle, supabase, senders } = params

  const { data: ctxData, error } = await supabase.rpc('get_agent_context', {
    p_channel_type: channelType,
    p_external_id: externalId,
    p_from_handle: fromHandle,
  })
  if (error || !ctxData) return

  const ctx = ctxData as unknown as AgentContext
  if (!ctx.conversation?.should_respond) return

  const convId = ctx.conversation.id

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
