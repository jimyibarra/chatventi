import { createServiceClient } from '@/lib/supabase/service'

// Bucket público de imágenes (logo, productos, profesionales).
export const MEDIA_BUCKET = 'media'

const PUBLIC_MARKER = `/object/public/${MEDIA_BUCKET}/`

// Borra un objeto del bucket `media` a partir de su URL pública. Best-effort:
// nunca lanza (si falla, se deja el objeto; peor caso, huérfano inofensivo).
// Usa service_role a propósito: el borrado corre en Server Actions y no depende
// de un policy de DELETE en el browser. Ignora URLs ajenas al bucket.
export async function removeMediaByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return
  const i = url.indexOf(PUBLIC_MARKER)
  if (i === -1) return
  const path = decodeURIComponent(url.slice(i + PUBLIC_MARKER.length))
  if (!path) return
  try {
    const admin = createServiceClient()
    await admin.storage.from(MEDIA_BUCKET).remove([path])
  } catch (e) {
    console.error('[storage] removeMediaByUrl error', e)
  }
}
