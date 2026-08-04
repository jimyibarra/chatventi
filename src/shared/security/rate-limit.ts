// =====================================================================
// Límite de tasa DURABLE (contado en la base de datos).
//
// Por qué no un Map en memoria: Vercel levanta muchas instancias y las
// recicla en frío. Un contador en memoria da un tope real de N×límite y se
// borra solo — es decir, no es un tope. Todo lo que deba sostenerse va a BD.
//
// Va por RPC SECURITY DEFINER con la clave ANON (patrón maestro del
// proyecto): el camino del alta no tiene sesión y RLS no le deja escribir
// nada por su cuenta.
// =====================================================================

import { createWebhookClient } from '@/lib/supabase/webhook'

/** Cubos en uso. Tipado para que un typo no cree un cubo fantasma sin tope. */
export type RateBucket =
  | 'signup_ip'
  | 'signup_email'
  | 'demo_ip'
  | 'sandbox_org'
  | 'login_ip'
  // Análisis del sitio web para la voz de marca: cada intento hace que el
  // servidor descargue una URL escrita por el usuario y gaste una llamada de IA.
  | 'voice_extract'

export interface RateLimitOptions {
  bucket: RateBucket
  /** IP, id de organización o correo canónico. */
  key: string
  /** Máximo de eventos permitidos dentro de la ventana. */
  limit: number
  windowSeconds: number
}

/**
 * Registra un intento y dice si se PERMITE continuar.
 *
 * Falla CERRADO: si la RPC devuelve error o algo inesperado, se devuelve
 * `false` (bloquea). Es la única postura correcta para una guarda — si al
 * fallar dejara pasar, un simple corte de red abriría el registro entero.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<boolean> {
  const key = options.key.trim()
  if (!key || key === 'unknown') {
    // Sin clave fiable no se puede limitar a nadie en concreto. Se deja pasar
    // a propósito: bloquear a todo el que venga sin IP legible cerraría el
    // registro a usuarios legítimos tras proxys raros. Las demás capas
    // (Turnstile, desechables, tope de consumo) siguen aplicando.
    return true
  }
  try {
    const supabase = createWebhookClient()
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: options.bucket,
      p_key: key,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    })
    if (error) return false
    return data === true
  } catch {
    return false
  }
}

/**
 * Cuenta eventos de la ventana SIN registrar uno nuevo.
 * Devuelve `null` si no se pudo consultar (quien llama decide).
 */
export async function countRateEvents(
  bucket: RateBucket,
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  const trimmed = key.trim()
  if (!trimmed) return null
  try {
    const supabase = createWebhookClient()
    const { data, error } = await supabase.rpc('count_rate_events', {
      p_bucket: bucket,
      p_key: trimmed,
      p_window_seconds: windowSeconds,
    })
    if (error || typeof data !== 'number') return null
    return data
  } catch {
    return null
  }
}
