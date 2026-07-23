'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { BUSINESS_TEMPLATES } from './business-templates'
import { sendToCustomerByChannel } from './senders'

export type ActionResult = { ok: true } | { ok: false; error: string }

// NOTA: `model` NO viaja aquí. Es del sistema y lo administra el SUPERADMIN
// (/admin/agente). En el upsert se OMITE la columna a propósito: en conflicto se
// preserva el modelo existente y en un insert nuevo aplica el default de la BD
// (openai/gpt-4o-mini). Si se incluyera con un form que ya no lo manda, lo
// pondría en null y violaría el NOT NULL.
const configSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  approvalMode: z.enum(['off', 'low_confidence', 'always']),
  approvalTelegramChatId: z.string().trim().max(64).optional(),
  systemPrompt: z.string().trim().max(4000).optional(),
})

export async function saveAgentConfig(raw: unknown): Promise<ActionResult> {
  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  const { error } = await supabase.from('agent_configs').upsert(
    {
      organization_id: orgId,
      enabled: parsed.data.enabled ?? false,
      approval_mode: parsed.data.approvalMode,
      approval_telegram_chat_id: parsed.data.approvalTelegramChatId || null,
      system_prompt: parsed.data.systemPrompt || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )
  if (error) return { ok: false, error: 'No se pudo guardar la configuración.' }
  revalidatePath('/dashboard/agente')
  return { ok: true }
}

// Persiste el rubro del negocio (para plantillas del agente y usos futuros).
export async function setBusinessType(businessType: string): Promise<ActionResult> {
  const key = (businessType ?? '').trim()
  if (!key || !BUSINESS_TEMPLATES.some((t) => t.key === key)) {
    return { ok: false, error: 'Tipo de negocio inválido.' }
  }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { error } = await supabase
    .from('organizations')
    .update({ business_type: key })
    .eq('id', orgId)
  if (error) return { ok: false, error: 'No se pudo guardar el tipo de negocio.' }
  revalidatePath('/dashboard/agente')
  return { ok: true }
}

// Aplica la plantilla del rubro: fija el prompt propuesto y (opcional) agrega el
// conocimiento base, SIN duplicar frases ya cargadas. También persiste el rubro.
// El prompt SÍ se reemplaza: la UI avisa cuando ya había uno propio.
export async function applyBusinessTemplate(
  businessType: string,
  includeKnowledge: boolean
): Promise<ActionResult> {
  const template = BUSINESS_TEMPLATES.find((t) => t.key === (businessType ?? '').trim())
  if (!template) return { ok: false, error: 'Tipo de negocio inválido.' }

  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const orgName = org?.name ?? 'tu negocio'

  // Rubro + prompt propuesto (upsert que preserva enabled/model/approval).
  const { error: orgErr } = await supabase
    .from('organizations')
    .update({ business_type: template.key })
    .eq('id', orgId)
  if (orgErr) return { ok: false, error: 'No se pudo guardar el tipo de negocio.' }

  const { error: cfgErr } = await supabase.from('agent_configs').upsert(
    {
      organization_id: orgId,
      system_prompt: template.prompt(orgName),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )
  if (cfgErr) return { ok: false, error: 'No se pudo aplicar la plantilla.' }

  if (includeKnowledge && template.knowledge.length > 0) {
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('content')
      .eq('organization_id', orgId)
    const have = new Set((existing ?? []).map((k) => k.content.trim()))
    const toAdd = template.knowledge
      .filter((c) => !have.has(c.trim()))
      .map((content) => ({ organization_id: orgId, content, source: 'plantilla' }))
    if (toAdd.length > 0) {
      const { error: kbErr } = await supabase.from('knowledge_base').insert(toAdd)
      if (kbErr) return { ok: false, error: 'Se aplicó el prompt pero no el conocimiento base.' }
    }
  }

  revalidatePath('/dashboard/agente')
  return { ok: true }
}

export async function addKnowledge(content: string, source?: string): Promise<ActionResult> {
  const text = (content ?? '').trim()
  if (!text) return { ok: false, error: 'El contenido no puede estar vacío.' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { error } = await supabase
    .from('knowledge_base')
    .insert({ organization_id: orgId, content: text, source: source || null })
  if (error) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath('/dashboard/agente')
  return { ok: true }
}

export async function deleteKnowledge(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('knowledge_base').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar.' }
  revalidatePath('/dashboard/agente')
  return { ok: true }
}

// ---- Respuesta manual del negocio (Ola 2, Fase A) -------------------
// Envía por el canal del cliente, registra sender='agent' y PAUSA la IA
// automáticamente para que humano y bot no se pisen.
const MANUAL_PAUSE_MINUTES = 30
const replySchema = z.string().trim().min(1, 'Escribe un mensaje.').max(2000)

export async function sendManualReply(
  conversationId: string,
  rawText: string
): Promise<ActionResult> {
  const parsed = replySchema.safeParse(rawText)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Mensaje inválido' }
  }
  const text = parsed.data

  // Cliente autenticado: RLS garantiza que la conversación es de SU org.
  const supabase = await createClient()
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, client:clients(phone), channel:channels(type, external_id)')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) return { ok: false, error: 'Conversación no encontrada.' }

  const client = (conv.client as { phone: string | null } | null) ?? null
  const channel = (conv.channel as { type: string; external_id: string } | null) ?? null
  if (!client?.phone || !channel) {
    return { ok: false, error: 'La conversación no tiene destinatario o canal.' }
  }

  const service = createServiceClient()
  const externalId = await sendToCustomerByChannel(
    service,
    channel.type,
    channel.external_id,
    client.phone,
    text
  )
  if (!externalId) {
    return {
      ok: false,
      error:
        channel.type === 'whatsapp'
          ? 'No se pudo enviar por WhatsApp (revisa la conexión del número).'
          : 'No se pudo enviar el mensaje. Intenta de nuevo.',
    }
  }

  const [{ error: logError }, { error: pauseError }] = await Promise.all([
    supabase.rpc('log_outbound_message', {
      p_conversation_id: conversationId,
      p_body: text,
      p_sender: 'agent',
      p_external_id: externalId,
    }),
    supabase.rpc('pause_ai', {
      p_conversation_id: conversationId,
      p_minutes: MANUAL_PAUSE_MINUTES,
    }),
  ])
  if (logError) console.error('[sendManualReply] log_outbound_message', logError.message)
  if (pauseError) console.error('[sendManualReply] pause_ai', pauseError.message)

  revalidatePath(`/dashboard/conversaciones/${conversationId}`)
  revalidatePath('/dashboard/conversaciones')
  return { ok: true }
}

// ---- Controles de conversación -------------------------------------
export async function setAiEnabled(conversationId: string, enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_ai_enabled', {
    p_conversation_id: conversationId,
    p_enabled: enabled,
  })
  if (error) return { ok: false, error: 'No se pudo actualizar la IA.' }
  revalidatePath('/dashboard/conversaciones')
  revalidatePath(`/dashboard/conversaciones/${conversationId}`)
  return { ok: true }
}

export async function pauseAi(conversationId: string, minutes = 60): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('pause_ai', {
    p_conversation_id: conversationId,
    p_minutes: minutes,
  })
  if (error) return { ok: false, error: 'No se pudo pausar la IA.' }
  revalidatePath('/dashboard/conversaciones')
  revalidatePath(`/dashboard/conversaciones/${conversationId}`)
  return { ok: true }
}

export async function resumeAi(conversationId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('resume_ai', {
    p_conversation_id: conversationId,
  })
  if (error) return { ok: false, error: 'No se pudo reanudar la IA.' }
  revalidatePath('/dashboard/conversaciones')
  revalidatePath(`/dashboard/conversaciones/${conversationId}`)
  return { ok: true }
}

export async function setConversationStatus(
  conversationId: string,
  status: 'open' | 'pending' | 'closed'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_conversation_status', {
    p_conversation_id: conversationId,
    p_status: status,
  })
  if (error) return { ok: false, error: 'No se pudo cambiar el estado.' }
  revalidatePath('/dashboard/conversaciones')
  revalidatePath(`/dashboard/conversaciones/${conversationId}`)
  return { ok: true }
}
