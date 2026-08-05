import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'

// =====================================================================
// Calificación de la conversación (Fase 4).
//
// Corre en el cron, sobre conversaciones ya enfriadas: nunca durante la
// atención. Si sale mal (≤ 2) se avisa al dueño, que es el punto entero de
// la capacidad — hoy una conversación que se tuerce no la ve nadie.
// =====================================================================

// Barato: es una lectura de texto, no atención al cliente.
const SCORING_MODEL = 'openai/gpt-4o-mini'

// Por debajo de esto se avisa al dueño.
export const BAD_SCORE_THRESHOLD = 2

const PROMPT = `Eres un supervisor de atención al cliente. Vas a leer una conversación entre el asistente de un negocio y un cliente.
Califica del 1 al 5 la CALIDAD DE LA ATENCIÓN que dio el negocio:
5 = resolvió lo que el cliente quería, con buen trato.
3 = correcta pero mejorable, o quedó a medias.
1 = el cliente se fue molesto, sin respuesta, o el asistente se equivocó.
No juzgues al cliente ni la ortografía: juzga si el negocio atendió bien.
Responde SOLO con un JSON: {"score": <1-5>, "reason": "<motivo en una frase corta, en español>"}`

const resultSchema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string().min(1),
})

export type ConversationScore = { score: number; reason: string }

/**
 * Devuelve la calificación, o null si no se pudo (sin API key, proveedor
 * caído, respuesta no parseable). Nunca lanza: el cron sigue con la
 * siguiente conversación.
 */
export async function scoreConversation(
  messages: { direction: string; sender: string; body: string | null }[]
): Promise<ConversationScore | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[scoring] falta OPENROUTER_API_KEY')
    return null
  }

  const transcript = messages
    .filter((m) => (m.body ?? '').trim().length > 0)
    .map((m) => `${m.direction === 'inbound' ? 'CLIENTE' : 'NEGOCIO'}: ${m.body?.trim()}`)
    .join('\n')
  if (transcript.length === 0) return null

  try {
    const openrouter = createOpenRouter({ apiKey })
    const { text } = await generateText({
      model: openrouter(SCORING_MODEL),
      system: PROMPT,
      messages: [{ role: 'user', content: transcript }],
    })

    // El modelo a veces envuelve el JSON en ```json … ```.
    const raw = (text ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = resultSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error('[scoring] respuesta inesperada', text)
      return null
    }
    return { score: parsed.data.score, reason: parsed.data.reason.trim() }
  } catch (e) {
    console.error('[scoring] error', e)
    return null
  }
}
