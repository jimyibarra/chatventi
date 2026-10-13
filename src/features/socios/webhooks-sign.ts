import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

// Parte pura de los webhooks de socios (firma y validación de la URL): sin
// 'server-only' para poder probarla con vitest. La usa webhooks.ts.

// ---------------------------------------------------------------------
// Firma. Cabeceras de cada entrega:
//   X-ChatVenti-Event, X-ChatVenti-Delivery, X-ChatVenti-Timestamp (unix s)
//   X-ChatVenti-Signature: v1=<hex HMAC-SHA256(secret, `${timestamp}.${body}`)>
// ---------------------------------------------------------------------
export function signWebhook(secret: string, timestamp: string | number, body: string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

/** Para la documentación y las pruebas: cómo debe verificar el socio. Tolera 5 min de desfase. */
export function verifyWebhookSignature(
  secret: string,
  header: string | null,
  timestamp: string | null,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !timestamp || !/^\d{1,12}$/.test(timestamp)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > 5 * 60) return false
  const expected = Buffer.from(signWebhook(secret, timestamp, body))
  const given = Buffer.from(header.trim())
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function newWebhookSecret(): string {
  return `cvw_${randomBytes(24).toString('hex')}`
}

/**
 * El endpoint lo escribe el socio y la petición sale de NUESTRO servidor:
 * solo https, con nombre de dominio público (ni IP literal, ni localhost, ni
 * dominios internos). La resolución DNS no se comprueba aquí: la petición
 * solo lleva datos de citas y el cuerpo firmado, nunca credenciales nuestras.
 */
export function validateWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { ok: false, error: 'La URL no es válida.' }
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'El webhook debe ser https.' }
  if (u.username || u.password) return { ok: false, error: 'La URL no puede llevar usuario ni contraseña.' }
  if (raw.length > 500) return { ok: false, error: 'URL demasiado larga (máximo 500).' }
  const host = u.hostname.toLowerCase()
  if (isIP(host) || host === 'localhost' || !host.includes('.')) return { ok: false, error: 'Usa un dominio público.' }
  if (/\.(local|localhost|internal|lan|home|arpa)$/.test(host)) return { ok: false, error: 'Usa un dominio público.' }
  return { ok: true, url: u.toString() }
}

