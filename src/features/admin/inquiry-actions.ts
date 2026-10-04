'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// La RPC valida super_admin DENTRO de la base (doble guarda con el layout /admin).
export async function resolveBillingInquiry(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Aclaración inválida.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_resolve_billing_inquiry', { p_id: parsed.data })
  if (error) return { ok: false, error: 'No se pudo marcar como resuelta.' }
  revalidatePath('/admin')
  return { ok: true }
}
