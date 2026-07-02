import { createClient } from '@supabase/supabase-js'

/**
 * Cliente service_role: BYPASSA RLS. Solo para contextos server de confianza
 * (crons, tareas administrativas). NUNCA exponer al browser.
 * Patron portado de SastrePro2 (src/lib/supabase/service.ts).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
