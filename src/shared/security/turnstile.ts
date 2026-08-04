// =====================================================================
// Cloudflare Turnstile — verificación anti-bot del lado del SERVIDOR.
//
// El widget del navegador no protege nada por sí solo: cualquiera puede
// llamar a la acción sin pasar por él. Lo que protege es este siteverify.
//
// SENTIDO DEL FALLO (regla de CLAUDE.md, 2026-07-15): si Turnstile ESTÁ
// configurado y la verificación falla —token inválido, red caída, respuesta
// rara— se BLOQUEA. Una guarda cuya consulta falla y deja pasar a todos está
// escrita al revés. El único caso que pasa sin verificar es la ausencia
// explícita de TURNSTILE_SECRET_KEY (desarrollo local), y se anuncia.
// =====================================================================

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

export interface TurnstileResult {
  ok: boolean
  /** true cuando no hay clave configurada: no se verificó nada. */
  skipped: boolean
  /** Código de Cloudflare o motivo interno, para registro (nunca al usuario). */
  reason?: string
}

/** ¿Hay clave secreta? Si no, el widget no se exige (solo desarrollo). */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

/**
 * Valida el token del widget contra Cloudflare.
 *
 * @param token Valor de `cf-turnstile-response` enviado por el formulario.
 * @param remoteIp IP del visitante (opcional, mejora la señal).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { ok: true, skipped: true, reason: 'sin_clave_configurada' }
  }
  if (!token) {
    return { ok: false, skipped: false, reason: 'sin_token' }
  }

  const body = new URLSearchParams({ secret, response: token })
  // Solo se manda si es una IP de verdad: 'unknown' haría fallar la validación
  // de Cloudflare y tumbaría un alta legítima.
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      return { ok: false, skipped: false, reason: `http_${response.status}` }
    }
    const data: unknown = await response.json()
    const success =
      typeof data === 'object' && data !== null && (data as { success?: unknown }).success === true
    if (success) return { ok: true, skipped: false }

    const codes =
      typeof data === 'object' && data !== null
        ? (data as { 'error-codes'?: unknown })['error-codes']
        : undefined
    return {
      ok: false,
      skipped: false,
      reason: Array.isArray(codes) ? codes.join(',') : 'rechazado',
    }
  } catch (error) {
    // Red caída o tiempo agotado: se BLOQUEA (falla cerrado).
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? `excepcion:${error.name}` : 'excepcion',
    }
  }
}
