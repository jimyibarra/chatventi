import { z } from 'zod'

// =====================================================================
// Transcripción de notas de voz (Fase 3).
//
// 🔴 NO va por OpenRouter: no expone speech-to-text de forma fiable. Hace
// falta OTRO proveedor y, por tanto, otra API key. Se admiten dos, en este
// orden, y basta con tener UNA:
//     GROQ_API_KEY    → whisper-large-v3-turbo (más barato y rápido)
//     OPENAI_API_KEY  → whisper-1
// Sin ninguna de las dos, la transcripción devuelve null y el sistema
// degrada al aviso + escalamiento de siempre. Es decir: la capacidad se
// puede encender en el panel sin que nada se rompa, simplemente no lee.
// =====================================================================

const PROVIDERS = [
  {
    env: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
  },
  {
    env: 'OPENAI_API_KEY',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
  },
] as const

// Una nota de voz larga no debe colgar el `after()` del webhook.
const TIMEOUT_MS = 30_000

// Ambos proveedores hablan el dialecto de OpenAI: { text }.
const responseSchema = z.object({ text: z.string() })

/** ¿Hay algún proveedor de transcripción configurado? */
export function transcriptionAvailable(): boolean {
  return PROVIDERS.some((p) => Boolean(process.env[p.env]))
}

/**
 * Audio → texto. Devuelve null si no hay proveedor, si falla o si el audio
 * viene vacío. Nunca lanza: quien llama degrada al aviso de siempre.
 */
export async function transcribeAudio(
  bytes: ArrayBuffer,
  mime: string
): Promise<string | null> {
  const provider = PROVIDERS.find((p) => Boolean(process.env[p.env]))
  if (!provider) {
    console.error('[transcribe] sin proveedor: falta GROQ_API_KEY u OPENAI_API_KEY')
    return null
  }

  try {
    const form = new FormData()
    // El nombre del archivo importa: ambos proveedores deducen el formato de
    // la extensión, y una nota de voz de WhatsApp/Telegram es ogg/opus.
    form.append('file', new Blob([bytes], { type: mime }), `audio.${extFor(mime)}`)
    form.append('model', provider.model)
    form.append('language', 'es')
    form.append('response_format', 'json')

    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env[provider.env]}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error('[transcribe] falló', provider.env, res.status, await res.text().catch(() => ''))
      return null
    }
    const parsed = responseSchema.safeParse(await res.json())
    if (!parsed.success) {
      console.error('[transcribe] respuesta inesperada', parsed.error.message)
      return null
    }
    const clean = parsed.data.text.trim()
    return clean.length > 0 ? clean : null
  } catch (e) {
    console.error('[transcribe] error', e)
    return null
  }
}

function extFor(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('aac')) return 'aac'
  if (mime.includes('amr')) return 'amr'
  return 'ogg'
}
