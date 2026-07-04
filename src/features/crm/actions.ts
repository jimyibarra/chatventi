'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const tagSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
    .optional(),
})

export async function createTag(raw: unknown): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { error } = await supabase
    .from('tags')
    .insert({ organization_id: orgId, name: parsed.data.name, color: parsed.data.color ?? '#64748b' })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una etiqueta con ese nombre.' }
    return { ok: false, error: 'No se pudo crear la etiqueta.' }
  }
  revalidatePath('/dashboard/clientes')
  return { ok: true }
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar.' }
  revalidatePath('/dashboard/clientes')
  return { ok: true }
}

export async function tagClient(clientId: string, tagId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('client_tags')
    .insert({ client_id: clientId, tag_id: tagId })
  if (error && error.code !== '23505') return { ok: false, error: 'No se pudo etiquetar.' }
  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/clientes')
  return { ok: true }
}

export async function untagClient(clientId: string, tagId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('client_tags')
    .delete()
    .eq('client_id', clientId)
    .eq('tag_id', tagId)
  if (error) return { ok: false, error: 'No se pudo quitar la etiqueta.' }
  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/clientes')
  return { ok: true }
}

const clientSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export async function updateClient(raw: unknown): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ name: parsed.data.name || null, notes: parsed.data.notes || null })
    .eq('id', parsed.data.clientId)
  if (error) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath(`/dashboard/clientes/${parsed.data.clientId}`)
  revalidatePath('/dashboard/clientes')
  return { ok: true }
}
