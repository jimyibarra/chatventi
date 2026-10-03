'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type CreatePartnerResult = { ok: true; apiKey: string } | { ok: false; error: string }
export type PartnerActionResult = { ok: true } | { ok: false; error: string }

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  billingEmail: z.string().trim().email(),
  discountPct: z.coerce.number().min(0).max(100),
})

// Las RPC admin_* validan super_admin DENTRO de la base (doble guarda con el
// layout /admin). La clave del socio se devuelve una sola vez y no se guarda
// en ningún sitio más que en la pantalla de quien la crea.
export async function createPartner(raw: unknown): Promise<CreatePartnerResult> {
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Revisa el nombre, el correo y el descuento.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_create_partner', {
    p_name: parsed.data.name,
    p_billing_email: parsed.data.billingEmail,
    p_discount_pct: parsed.data.discountPct,
  })
  if (error) {
    return { ok: false, error: error.message.includes('forbidden') ? 'No autorizado.' : 'No se pudo crear el socio.' }
  }
  revalidatePath('/admin/socios')
  return { ok: true, apiKey: (data as { api_key: string }).api_key }
}

export async function setPartnerStatus(id: string, status: 'active' | 'suspended'): Promise<PartnerActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_partner_status', { p_id: id, p_status: status })
  if (error) return { ok: false, error: 'No se pudo cambiar el estado.' }
  revalidatePath('/admin/socios')
  return { ok: true }
}

const updateSchema = createSchema.extend({ id: z.string().uuid() })

export async function updatePartner(raw: unknown): Promise<PartnerActionResult> {
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Revisa el nombre, el correo y el descuento (0 a 100).' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_update_partner', {
    p_id: parsed.data.id,
    p_name: parsed.data.name,
    p_billing_email: parsed.data.billingEmail,
    p_discount_pct: parsed.data.discountPct,
  })
  if (error) return { ok: false, error: 'No se pudieron guardar los cambios.' }
  revalidatePath('/admin/socios')
  return { ok: true }
}

// Clave nueva: la anterior deja de funcionar en ese momento.
export async function rotatePartnerKey(id: string): Promise<CreatePartnerResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_rotate_partner_key', { p_id: id })
  if (error) return { ok: false, error: 'No se pudo generar la clave nueva.' }
  revalidatePath('/admin/socios')
  return { ok: true, apiKey: (data as { api_key: string }).api_key }
}

// Solo se elimina un socio sin negocios; con negocios se suspende (historia).
export async function deletePartner(id: string): Promise<PartnerActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_delete_partner', { p_id: id })
  if (error) {
    return {
      ok: false,
      error: error.message.includes('has_organizations')
        ? 'Tiene negocios dados de alta: suspéndelo en vez de eliminarlo.'
        : 'No se pudo eliminar.',
    }
  }
  revalidatePath('/admin/socios')
  return { ok: true }
}
