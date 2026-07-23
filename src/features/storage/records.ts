import { createServiceClient } from '@/lib/supabase/service'

// Bucket PRIVADO del expediente del cliente (archivos clínicos, consentimientos,
// recetas, fotos). A diferencia de `media`, NO es público: se lee solo por URL
// firmada con caducidad corta. Ver PRP `prp-historial-clinico.md`.
export const RECORDS_BUCKET = 'records'

// 5 minutos: suficiente para abrir o descargar, corto para que un enlace
// reenviado por error no siga sirviendo mañana.
const SIGNED_URL_TTL_SECONDS = 300

// Firma una URL temporal de lectura. Devuelve null si el objeto no existe o la
// firma falla (el UI muestra el error, no revienta la ficha entera).
export async function signRecordUrl(path: string): Promise<string | null> {
  try {
    const admin = createServiceClient()
    const { data, error } = await admin.storage
      .from(RECORDS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) {
      console.error('[storage] signRecordUrl error', error.message)
      return null
    }
    return data?.signedUrl ?? null
  } catch (e) {
    console.error('[storage] signRecordUrl error', e)
    return null
  }
}

// Borra un objeto del bucket privado. Best-effort: nunca lanza (peor caso queda
// un huérfano invisible, que no es accesible sin firma).
export async function removeRecordByPath(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    const admin = createServiceClient()
    await admin.storage.from(RECORDS_BUCKET).remove([path])
  } catch (e) {
    console.error('[storage] removeRecordByPath error', e)
  }
}
