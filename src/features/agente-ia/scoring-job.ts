import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { notifyOrgOwners } from '@/features/notifications/send'
import { scoreConversation, BAD_SCORE_THRESHOLD } from './scoring'

type ServiceClient = SupabaseClient<Database>

// Cuánto silencio convierte una conversación en "terminada" a efectos de
// calificarla. 2 h: lo bastante para no cortar una charla viva, y lo bastante
// corto para que el dueño se entere el mismo día de una que salió mal.
export const SCORING_IDLE_MINUTES = 120

export type ScoringSummary = {
  scored: number
  skipped: number
  failed: number
  alerts: number
}

/**
 * Califica del 1 al 5 las conversaciones ya enfriadas y avisa al dueño de las
 * que salieron mal. Vive fuera del cron —que ya multiplexa seis trabajos y
 * roza las 500 líneas— para poder ejercitarlo aislado, sin disparar de paso
 * recordatorios y correos reales.
 *
 * Solo alcanza a las orgs con la capacidad ENCENDIDA (lo filtra
 * `get_conversations_to_score`): con todo apagado no hace ni una llamada al
 * modelo.
 *
 * Idempotencia: `claim_conversation_scoring` marca `ai_scored_at` ANTES de
 * llamar al modelo. Un reintento de Vercel no vuelve a pagar la llamada, y una
 * conversación cuya calificación falle queda marcada sin nota — se prefiere
 * eso a arriesgar un bucle de gasto.
 */
export async function runConversationScoring(
  service: ServiceClient
): Promise<ScoringSummary> {
  const out: ScoringSummary = { scored: 0, skipped: 0, failed: 0, alerts: 0 }

  const { data, error } = await service.rpc('get_conversations_to_score', {
    p_idle_minutes: SCORING_IDLE_MINUTES,
  })
  if (error) {
    console.error('[cron-scoring] get_conversations_to_score error', error.message)
    return out
  }
  const items =
    (data as { conversation_id: string; organization_id: string; client_name: string | null }[]) ??
    []

  for (const item of items) {
    const { data: claimed } = await service.rpc('claim_conversation_scoring', {
      p_conversation_id: item.conversation_id,
    })
    if (!claimed) {
      out.skipped++
      continue
    }

    const { data: messages } = await service
      .from('messages')
      .select('direction, sender, body')
      .eq('conversation_id', item.conversation_id)
      .order('created_at', { ascending: true })
      .limit(40)

    const result = await scoreConversation(messages ?? [])
    if (!result) {
      out.failed++
      continue
    }

    await service.rpc('save_conversation_score', {
      p_conversation_id: item.conversation_id,
      p_score: result.score,
      p_reason: result.reason,
    })
    out.scored++

    if (result.score <= BAD_SCORE_THRESHOLD) {
      await notifyOrgOwners(item.organization_id, {
        title: `Una conversación salió mal (${result.score}/5) ⚠️`,
        body: `${item.client_name ?? 'Un cliente'}: ${result.reason}`,
        tag: 'escalation',
        data: { url: `/dashboard/conversaciones/${item.conversation_id}` },
      })
      out.alerts++
    }
  }

  return out
}
