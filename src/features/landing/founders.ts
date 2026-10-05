import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { FOUNDERS } from './data'

/** Lugares de fundador ya tomados (altas con ?ref=fundadores). Si falla, se ven libres. */
export async function foundersTaken(): Promise<number> {
  try {
    const { count } = await createServiceClient()
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('signup_ref', 'fundadores')
    return Math.min(count ?? 0, FOUNDERS.seats)
  } catch {
    return 0
  }
}
