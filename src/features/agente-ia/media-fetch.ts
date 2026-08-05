import { z } from 'zod'
import { INBOUND_MAX_BYTES, normalizeMime } from '@/features/storage/inbound'

// =====================================================================
// Descarga del binario que manda el cliente. WhatsApp y Telegram NO son
// intercambiables: cada uno exige dos llamadas propias y su token.
//
// Todo aquí devuelve null en vez de lanzar: esto corre en `after()`, tras
// haber respondido 200. Un archivo que no se pudo bajar degrada al aviso
// de siempre; nunca rompe la conversación.
// =====================================================================

const WA_GRAPH_VERSION = 'v21.0'

// Las descargas corren después del ACK, pero no pueden quedarse colgadas:
// la función serverless tiene su propio techo de ejecución.
const FETCH_TIMEOUT_MS = 15_000

export type FetchedMedia = { bytes: ArrayBuffer; mime: string }

// Graph responde la URL real del binario, que caduca y exige el token.
const waMediaSchema = z.object({
  url: z.string().url(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

const tgFileSchema = z.object({
  ok: z.boolean(),
  result: z
    .object({
      file_path: z.string().optional(),
      file_size: z.number().optional(),
    })
    .optional(),
})

/** Lee el cuerpo respetando el tope de tamaño. */
async function readBounded(res: Response): Promise<ArrayBuffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > INBOUND_MAX_BYTES) {
    console.error('[media-fetch] archivo demasiado grande', declared)
    return null
  }
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength === 0 || bytes.byteLength > INBOUND_MAX_BYTES) {
    console.error('[media-fetch] tamaño fuera de rango', bytes.byteLength)
    return null
  }
  return bytes
}

/**
 * WhatsApp Cloud API: dos llamadas. Primero Graph devuelve una URL
 * temporal para el `mediaId`; después esa URL se descarga **con el mismo
 * token** (sin él responde 401, no el binario).
 */
export async function fetchWhatsAppMedia(
  mediaId: string,
  token: string
): Promise<FetchedMedia | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${WA_GRAPH_VERSION}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (!metaRes.ok) {
      console.error('[media-fetch] wa metadata falló', metaRes.status)
      return null
    }
    const parsed = waMediaSchema.safeParse(await metaRes.json())
    if (!parsed.success) {
      console.error('[media-fetch] wa metadata inesperada', parsed.error.message)
      return null
    }
    const { url, mime_type, file_size } = parsed.data
    if (file_size && file_size > INBOUND_MAX_BYTES) {
      console.error('[media-fetch] wa archivo demasiado grande', file_size)
      return null
    }

    const binRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!binRes.ok) {
      console.error('[media-fetch] wa descarga falló', binRes.status)
      return null
    }
    const mime = normalizeMime(mime_type ?? binRes.headers.get('content-type'))
    if (!mime) return null

    const bytes = await readBounded(binRes)
    return bytes ? { bytes, mime } : null
  } catch (e) {
    console.error('[media-fetch] wa error', e)
    return null
  }
}

/**
 * Telegram: `getFile` da una ruta y el binario se baja de un host
 * distinto que lleva el token en la propia URL. `getFile` NO devuelve el
 * MIME —viene en el mensaje (`voice.mime_type`, `document.mime_type`), y
 * las fotos no lo traen: son siempre JPEG.
 */
export async function fetchTelegramMedia(
  fileId: string,
  mimeHint: string | null
): Promise<FetchedMedia | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('[media-fetch] falta TELEGRAM_BOT_TOKEN')
    return null
  }
  try {
    const infoRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    )
    if (!infoRes.ok) {
      console.error('[media-fetch] tg getFile falló', infoRes.status)
      return null
    }
    const parsed = tgFileSchema.safeParse(await infoRes.json())
    if (!parsed.success || !parsed.data.ok || !parsed.data.result?.file_path) {
      console.error('[media-fetch] tg getFile inesperado')
      return null
    }
    const { file_path, file_size } = parsed.data.result
    if (file_size && file_size > INBOUND_MAX_BYTES) {
      console.error('[media-fetch] tg archivo demasiado grande', file_size)
      return null
    }

    const binRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${file_path}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    )
    if (!binRes.ok) {
      console.error('[media-fetch] tg descarga falló', binRes.status)
      return null
    }
    const mime = normalizeMime(mimeHint ?? binRes.headers.get('content-type'))
    if (!mime) return null

    const bytes = await readBounded(binRes)
    return bytes ? { bytes, mime } : null
  } catch (e) {
    console.error('[media-fetch] tg error', e)
    return null
  }
}
