'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { signupSchema } from '@/lib/validations/auth'
import { LEGAL } from '@/shared/constants/legal'
import { canonicalEmail } from '@/shared/security/email-canonical'
import { isDisposableEmail } from '@/shared/security/disposable-domains'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { getClientIp, getUserAgent } from '@/shared/security/request-context'
import { isTurnstileConfigured, verifyTurnstile } from '@/shared/security/turnstile'
import {
  ONE_DAY_SECONDS,
  ONE_HOUR_SECONDS,
  SIGNUP_MAX_PER_EMAIL_PER_HOUR,
  SIGNUP_MAX_PER_IP_PER_DAY,
  SIGNUP_MAX_PER_IP_PER_HOUR,
} from '@/shared/security/limits'

export type SignupResult = { ok: true } | { ok: false; error: string }

// El alta vive en el SERVIDOR desde 2026-08-03. Antes corría entera en el
// navegador (supabase.auth.signUp desde el cliente), y con ella allí ninguna
// defensa valía nada: cualquiera podía llamar a Supabase directamente
// saltándose el captcha, el límite por IP y el filtro de desechables.

/** Mensaje deliberadamente neutro: no confirma si un correo tiene cuenta. */
const GENERIC_EMAIL_ERROR =
  'No pudimos crear la cuenta con ese correo. Si ya tienes una, inicia sesión o recupera tu contraseña.'

/** Origen del sitio para el enlace del correo de verificación. */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('host') ?? 'www.chatventi.com'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

/**
 * Crea la CUENTA (no el negocio) y dispara el correo de verificación.
 *
 * Orden de las comprobaciones, de más barata a más cara y de menos a más
 * reveladora:
 *   1. forma de los datos      (Zod)
 *   2. Turnstile               (¿es una persona?)
 *   3. límite por IP           (¿cuántas cuentas lleva esta red?)
 *   4. correo desechable       (local, coste cero)
 *   5. límite por correo       (frena el machaque sobre una misma bandeja)
 *   6. bandeja ya registrada   (única que toca la base de usuarios)
 *
 * El usuario queda SIN perfil y SIN organización a propósito: eso lo hace el
 * asistente /bienvenida cuando el correo ya está verificado.
 */
export async function signUpAction(raw: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { email, password, turnstileToken } = parsed.data

  const requestHeaders = await headers()
  const ip = getClientIp(requestHeaders)
  const userAgent = getUserAgent(requestHeaders)

  // 2. Turnstile. Si hay clave configurada y no se puede verificar, se BLOQUEA.
  if (isTurnstileConfigured()) {
    const verdict = await verifyTurnstile(turnstileToken, ip)
    if (!verdict.ok) {
      return {
        ok: false,
        error: 'No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.',
      }
    }
  }

  // 3. Límite por IP: dos ventanas. La de hora frena la ráfaga; la de día,
  //    al que vuelve cada rato.
  const ipHourOk = await consumeRateLimit({
    bucket: 'signup_ip',
    key: ip,
    limit: SIGNUP_MAX_PER_IP_PER_HOUR,
    windowSeconds: ONE_HOUR_SECONDS,
  })
  const ipDayOk = await consumeRateLimit({
    bucket: 'signup_ip',
    key: `dia:${ip}`,
    limit: SIGNUP_MAX_PER_IP_PER_DAY,
    windowSeconds: ONE_DAY_SECONDS,
  })
  if (!ipHourOk || !ipDayOk) {
    return {
      ok: false,
      error: 'Demasiados intentos desde esta conexión. Espera un momento e inténtalo de nuevo.',
    }
  }

  // 4. Correo desechable.
  if (isDisposableEmail(email)) {
    return {
      ok: false,
      error: 'Usa un correo permanente (el de tu negocio). No admitimos correos temporales.',
    }
  }

  const canonical = canonicalEmail(email)
  if (!canonical) {
    return { ok: false, error: 'Correo inválido' }
  }

  // 5. Límite por bandeja.
  const emailOk = await consumeRateLimit({
    bucket: 'signup_email',
    key: canonical,
    limit: SIGNUP_MAX_PER_EMAIL_PER_HOUR,
    windowSeconds: ONE_HOUR_SECONDS,
  })
  if (!emailOk) {
    return {
      ok: false,
      error: 'Demasiados intentos con este correo. Revisa tu bandeja o espera unos minutos.',
    }
  }

  // 6. ¿Ya existe una cuenta para esta bandeja? Con el cliente de SERVICIO:
  //    la función no está otorgada a anon justamente para que el navegador no
  //    pueda usarla como enumerador de usuarios.
  try {
    const service = createServiceClient()
    const { data: exists, error } = await service.rpc('email_canonical_exists', {
      p_email: email,
    })
    // Falla CERRADO: si no se puede comprobar, no se crea la cuenta. Dejar
    // pasar ante un error convertiría un fallo de red en la puerta trasera
    // que esta comprobación existe para cerrar.
    if (error) return { ok: false, error: 'No pudimos completar el registro. Inténtalo en un momento.' }
    if (exists === true) return { ok: false, error: GENERIC_EMAIL_ERROR }
  } catch {
    return { ok: false, error: 'No pudimos completar el registro. Inténtalo en un momento.' }
  }

  // Alta. Cliente con cookies (no service_role) para que Supabase envíe el
  // correo de verificación y NO quede sesión abierta antes de verificarlo.
  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: {
        // Click-wrap: el sello de tiempo lo pone el servidor al crear el
        // perfil en /bienvenida (now() dentro de la RPC), no el cliente.
        pending_terms_version: LEGAL.termsVersion,
        // Huella del alta, para investigar patrones de abuso después.
        signup_ip: ip,
        signup_user_agent: userAgent,
      },
    },
  })
  if (error) {
    // Tampoco aquí se revela si el correo ya existía.
    return { ok: false, error: GENERIC_EMAIL_ERROR }
  }

  return { ok: true }
}
