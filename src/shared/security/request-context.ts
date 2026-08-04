// =====================================================================
// Huella de la petición: IP y navegador de quien se registra.
//
// No sirve para bloquear por sí sola (una IP puede ser un negocio entero
// tras NAT). Sirve para dos cosas concretas:
//   · alimentar el límite de tasa del alta
//   · dejar rastro en profiles para poder investigar un patrón de abuso
//     DESPUÉS, en vez de descubrirlo por la factura de OpenRouter.
// =====================================================================

/** Longitud máxima que guardamos del user-agent (los hay absurdamente largos). */
const MAX_USER_AGENT = 400

/**
 * IP del cliente a partir de las cabeceras del proxy.
 *
 * En Vercel, `x-forwarded-for` es una lista "cliente, proxy1, proxy2" y el
 * primero es el visitante. Devuelve 'unknown' si no hay nada legible; quien
 * llama decide qué hacer con eso (ver consumeRateLimit).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}

/** User-agent recortado, o null si no viene. */
export function getUserAgent(headers: Headers): string | null {
  const ua = headers.get('user-agent')?.trim()
  if (!ua) return null
  return ua.length > MAX_USER_AGENT ? ua.slice(0, MAX_USER_AGENT) : ua
}
