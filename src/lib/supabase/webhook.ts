import { createClient } from '@supabase/supabase-js'

/**
 * Cliente para webhooks / tareas SIN sesion de usuario.
 *
 * IMPORTANTE (patron maestro portado de SastrePro2): usa la ANON key, NO
 * service_role. Con ANON, RLS bloquea cualquier SELECT/UPDATE directo y
 * devuelve `null` SIN lanzar error. Por eso TODA escritura/lectura desde un
 * webhook DEBE ir por una RPC `SECURITY DEFINER` que valide autorizacion
 * internamente (ej. route_inbound_message en Fase 1).
 *
 * Ver memoria: chat-autoresponder-dedup-fix.
 */
export function createWebhookClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
