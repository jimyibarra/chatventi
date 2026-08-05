import { createServiceClient } from '@/lib/supabase/service'

// Bucket PRIVADO de media entrante (lo que el CLIENTE manda por chat:
// comprobantes, notas de voz, fotos). No se reutiliza `media` porque es
// público de lectura y solo admite imágenes. Ver la migración
// 20260805020000_inbound_media.sql y `records.ts`, que sigue este patrón.
export const INBOUND_BUCKET = 'inbound'

// 16 MB = el techo de WhatsApp para audio. Debe coincidir con el
// file_size_limit del bucket: si no, el rechazo llega tarde y en forma de
// error de Storage en vez de un aviso amable al cliente.
export const INBOUND_MAX_BYTES = 16 * 1024 * 1024

// 5 minutos: suficiente para abrir el archivo desde el dashboard, corto
// para que un enlace reenviado por error no siga sirviendo mañana.
const SIGNED_URL_TTL_SECONDS = 300

// MIME admitidos, alineados con el bucket. Lo que los clientes mandan de
// verdad por chat. El video queda fuera: pesa, no ayuda a agendar y nadie
// lo va a leer.
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
}

/**
 * Normaliza el MIME que reporta el proveedor. WhatsApp y Telegram añaden
 * parámetros ("audio/ogg; codecs=opus") que no coinciden con el filtro del
 * bucket, así que se corta por el `;` y se pasa a minúsculas.
 */
export function normalizeMime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.split(';')[0]?.trim().toLowerCase()
  return clean ? clean : null
}

/** ¿Sabemos guardar este tipo? */
export function isSupportedMime(mime: string | null | undefined): boolean {
  const clean = normalizeMime(mime)
  return Boolean(clean && clean in ALLOWED_MIME)
}

/** Extensión para el nombre del objeto (solo cosmética, el MIME manda). */
function extensionFor(mime: string): string {
  return ALLOWED_MIME[mime] ?? 'bin'
}

export type InboundUpload = { path: string; mime: string }

/**
 * Sube un binario entrante al bucket privado bajo `<orgId>/<convId>/<id>.<ext>`.
 * La carpeta por org NO es cosmética: `attach_message_media` exige que la
 * ruta empiece por la org dueña del mensaje, y la policy de lectura filtra
 * por ese primer segmento.
 *
 * Devuelve null (sin lanzar) si el tipo no está soportado, si el archivo
 * excede el límite o si Storage falla: la conversación no puede romperse
 * porque un adjunto no se pudo guardar.
 */
export async function uploadInboundMedia(params: {
  orgId: string
  conversationId: string
  bytes: ArrayBuffer
  mime: string | null | undefined
}): Promise<InboundUpload | null> {
  const { orgId, conversationId, bytes } = params
  const mime = normalizeMime(params.mime)

  if (!mime || !isSupportedMime(mime)) {
    console.error('[storage] inbound: MIME no soportado', params.mime)
    return null
  }
  if (bytes.byteLength === 0 || bytes.byteLength > INBOUND_MAX_BYTES) {
    console.error('[storage] inbound: tamaño fuera de rango', bytes.byteLength)
    return null
  }

  const path = `${orgId}/${conversationId}/${crypto.randomUUID()}.${extensionFor(mime)}`
  try {
    const admin = createServiceClient()
    const { error } = await admin.storage
      .from(INBOUND_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false })
    if (error) {
      console.error('[storage] uploadInboundMedia error', error.message)
      return null
    }
    return { path, mime }
  } catch (e) {
    console.error('[storage] uploadInboundMedia error', e)
    return null
  }
}

/** URL temporal de lectura para el dashboard. null si no se pudo firmar. */
export async function signInboundUrl(path: string): Promise<string | null> {
  try {
    const admin = createServiceClient()
    const { data, error } = await admin.storage
      .from(INBOUND_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) {
      console.error('[storage] signInboundUrl error', error.message)
      return null
    }
    return data?.signedUrl ?? null
  } catch (e) {
    console.error('[storage] signInboundUrl error', e)
    return null
  }
}

/**
 * Borra los archivos entrantes de una org. Se usa en la limpieza por
 * retención: si no, el bucket crece sin control y se convierte en un
 * pasivo de privacidad. Best-effort, nunca lanza.
 */
export async function removeInboundFolder(orgId: string): Promise<void> {
  try {
    const admin = createServiceClient()
    // list() no es recursivo: hay que bajar por conversación.
    const { data: convFolders } = await admin.storage.from(INBOUND_BUCKET).list(orgId)
    for (const folder of convFolders ?? []) {
      const { data: files } = await admin.storage
        .from(INBOUND_BUCKET)
        .list(`${orgId}/${folder.name}`)
      const paths = (files ?? []).map((f) => `${orgId}/${folder.name}/${f.name}`)
      if (paths.length > 0) await admin.storage.from(INBOUND_BUCKET).remove(paths)
    }
  } catch (e) {
    console.error('[storage] removeInboundFolder error', e)
  }
}
