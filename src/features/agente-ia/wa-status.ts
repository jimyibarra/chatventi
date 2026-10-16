// =====================================================================
// Estado de entrega de los mensajes que salen por WhatsApp.
//
// Meta avisa por el webhook (campo `statuses` de `messages`) cuando un mensaje
// se envió, se entregó, se leyó o falló. Antes se ignoraba: un retraso o un
// rechazo de Meta no se veía en ningún lado (16-oct-2026: un mensaje tardó
// 8 minutos en llegar y nadie podía saber si había salido).
// Lógica pura: sin `server-only` para poder probarla.
// =====================================================================

export const WA_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const
export type WaStatusValue = (typeof WA_STATUSES)[number]

export type WaStatus = { extId: string; status: WaStatusValue; at: string | null; error: string | null }

function isStatus(v: unknown): v is WaStatusValue {
  return typeof v === 'string' && (WA_STATUSES as readonly string[]).includes(v)
}

/** Lee `value.statuses` del webhook. Tolera formas inesperadas: lo que no entiende, lo salta. */
export function parseWaStatuses(value: unknown): WaStatus[] {
  const list = (value as { statuses?: unknown } | null)?.statuses
  if (!Array.isArray(list)) return []
  const out: WaStatus[] = []
  for (const raw of list) {
    const s = raw as { id?: unknown; status?: unknown; timestamp?: unknown; errors?: unknown }
    if (typeof s?.id !== 'string' || !s.id || !isStatus(s.status)) continue
    const ts = Number(s.timestamp)
    const at = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null
    let error: string | null = null
    if (s.status === 'failed' && Array.isArray(s.errors) && s.errors.length > 0) {
      const e = s.errors[0] as { code?: unknown; title?: unknown; message?: unknown }
      const code = typeof e.code === 'number' || typeof e.code === 'string' ? String(e.code) : ''
      const title = typeof e.title === 'string' ? e.title : typeof e.message === 'string' ? e.message : ''
      error = `${code}|${title}`.slice(0, 300)
    }
    out.push({ extId: s.id, status: s.status, at, error })
  }
  return out
}

// Motivos más comunes, en palabras del dueño. El resto se muestra con el texto de Meta.
const FAILED_REASONS: Record<string, string> = {
  '131042': 'falta la tarjeta (método de pago) en tu cuenta de WhatsApp en Meta',
  '131047': 'pasaron más de 24 horas desde el último mensaje del cliente',
  '131026': 'ese número no lo pudo recibir (quizá no tiene WhatsApp o su app es muy vieja)',
  '131049': 'Meta lo frenó para no saturar al cliente con mensajes de empresas',
  '131050': 'el cliente pidió no recibir mensajes de marketing',
  '131056': 'se mandaron demasiados mensajes seguidos a ese cliente',
}

/** Etiqueta corta para la burbuja del mensaje. null = no mostrar nada. */
export function waStatusLabel(status: string | null, error: string | null): { text: string; failed: boolean } | null {
  if (status === 'read') return { text: 'Leído', failed: false }
  if (status === 'delivered') return { text: 'Entregado', failed: false }
  if (status === 'sent') return { text: 'Enviado', failed: false }
  if (status === 'failed') {
    const [code = '', title = ''] = (error ?? '').split('|')
    const reason = FAILED_REASONS[code] ?? (title ? `Meta respondió: ${title}` : '')
    return { text: reason ? `No se entregó: ${reason}` : 'No se entregó', failed: true }
  }
  return null
}
