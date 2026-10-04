import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// =====================================================================
// Costo REAL de cada llamada a la IA (2026-10-04).
//
//   OpenRouter devuelve, si se le pide (`usage.include`), los tokens y el
//   costo en dólares de cada llamada. Aquí se suman por negocio, mes y
//   origen en `ai_costs` (privada: es el costo de ChatVenti, no lo ve el
//   negocio). Con eso /admin/agente compara el costo real por respuesta
//   contra el estimado de plans.ts (AI_TURN_COST_USD).
//
//   🔴 Nunca lanza ni detiene al agente: medir es secundario a responder.
// =====================================================================

export type AiCostSource = 'agente' | 'prueba' | 'superpoderes' | 'ventas'

/** A quién se le anota el costo. `orgId` null = página pública de ChatVenti. */
export type AiCostTag = { orgId: string | null; source: AiCostSource }

/** Ajuste de cada modelo de OpenRouter: que devuelva tokens y costo. */
export const OPENROUTER_USAGE = { usage: { include: true } }

type Step = {
  usage?: { inputTokens?: number; outputTokens?: number }
  providerMetadata?: Record<string, unknown>
}
type OpenRouterUsage = { promptTokens?: number; completionTokens?: number; cost?: number }

/**
 * Anota lo que gastó una llamada. Acepta el resultado de generateText (con
 * `steps`: una respuesta del agente puede usar varias llamadas al modelo) o
 * el de generateObject (una sola).
 */
export async function recordAiCost(tag: AiCostTag | undefined, result: Step & { steps?: Step[] }): Promise<void> {
  if (!tag) return
  try {
    const steps = result.steps?.length ? result.steps : [result]
    let tokensIn = 0
    let tokensOut = 0
    let cost = 0
    let withoutCost = 0
    for (const step of steps) {
      const usage = (step.providerMetadata?.openrouter as { usage?: OpenRouterUsage } | undefined)?.usage
      tokensIn += usage?.promptTokens ?? step.usage?.inputTokens ?? 0
      tokensOut += usage?.completionTokens ?? step.usage?.outputTokens ?? 0
      if (typeof usage?.cost === 'number') cost += usage.cost
      else withoutCost++
    }
    const { error } = await createServiceClient().rpc('record_ai_cost', {
      // null = página pública. Los tipos generados no admiten null en uuid,
      // pero la función sí (va a una fila sin negocio).
      p_org: tag.orgId as string,
      p_source: tag.source,
      p_calls: steps.length,
      p_calls_without_cost: withoutCost,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost: cost,
    })
    if (error) console.error('[costo-ia] no se pudo registrar', error.message)
  } catch (e) {
    console.error('[costo-ia] no se pudo registrar', e)
  }
}
