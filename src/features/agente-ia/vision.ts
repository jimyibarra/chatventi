import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// =====================================================================
// Lectura de imágenes (Fase 3). Lo más común en WhatsApp: el comprobante
// de pago. Antes el agente contestaba "no puedo revisar imágenes" y
// escalaba a una persona; ahora describe lo que ve y sigue la conversación.
//
// La lectura ocurre ANTES de invocar al agente y NO como una tool suya:
// runAgent corre con `stopWhen: stepCountIs(6)` y una tool de visión podría
// agotar los pasos a mitad de un agendamiento.
// =====================================================================

// 🔴 El modelo de la org (agent_configs.model) lo fija el panel SUPERADMIN y
// NO se puede asumir que tenga visión. Para leer imágenes se fuerza siempre
// uno que sí la tiene: es una llamada suelta, no cambia el modelo del agente.
const VISION_MODEL = 'openai/gpt-4o-mini'

// La lectura entra al historial del agente, así que se pide corta y factual.
// Sin interpretaciones: describir es útil, opinar sobre un pago no lo es.
const VISION_PROMPT = `Eres el asistente de un negocio que recibe imágenes por WhatsApp.
Describe en español y en 2 frases como máximo QUÉ se ve en la imagen, en términos útiles para atender al cliente.
Si es un comprobante o transferencia, di el monto, la fecha y a quién va dirigido si se leen; si algún dato no se lee, dilo.
Si es una foto de una persona, un lugar o un producto, descríbela en una frase.
No saludes, no des consejos y no inventes lo que no se vea con claridad.`

/**
 * Devuelve una descripción breve de la imagen, o null si no se pudo leer
 * (sin API key, proveedor caído, respuesta vacía). Nunca lanza: quien llama
 * degrada al aviso de siempre.
 */
export async function readImage(bytes: ArrayBuffer, mime: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[vision] falta OPENROUTER_API_KEY')
    return null
  }
  try {
    const openrouter = createOpenRouter({ apiKey })
    const { text } = await generateText({
      model: openrouter(VISION_MODEL),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image', image: new Uint8Array(bytes), mediaType: mime },
          ],
        },
      ],
    })
    const clean = text?.trim() ?? ''
    return clean.length > 0 ? clean : null
  } catch (e) {
    console.error('[vision] readImage error', e)
    return null
  }
}
