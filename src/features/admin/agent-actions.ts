'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

// Fija el modelo del agente de una org. La RPC admin_set_agent_model valida
// super_admin en la BD (doble guarda con el layout /admin).
export async function setOrgAgentModel(orgId: string, model: string): Promise<AdminActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_agent_model', { p_org: orgId, p_model: model })
  if (error) {
    if (error.message.includes('forbidden')) return { ok: false, error: 'No autorizado.' }
    if (error.message.includes('model_required')) return { ok: false, error: 'El modelo no puede estar vacío.' }
    return { ok: false, error: 'No se pudo guardar el modelo.' }
  }
  revalidatePath('/admin/agente')
  return { ok: true }
}
