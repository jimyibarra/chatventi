'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const configSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  model: z.string().trim().min(1).max(120),
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
      model: parsed.data.model,
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
