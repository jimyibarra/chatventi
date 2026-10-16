import 'server-only'
import { createClient } from '@/lib/supabase/server'

/** Organización del usuario con sesión si es dueño o gerente; null en cualquier otro caso (sin sesión, staff, sin org). */
export async function managerOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id || !['owner', 'manager'].includes(profile.role)) return null
  return profile.organization_id as string
}
