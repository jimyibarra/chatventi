'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const webConfigSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, 'El enlace debe tener 3-40 caracteres: minúsculas, números y guiones.'),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (formato #RRGGBB).')
    .optional(),
  description: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().url('URL de logo inválida.').optional().or(z.literal('')),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Número inválido: solo dígitos con lada, ej. 5215512345678.')
    .optional()
    .or(z.literal('')),
})

export async function saveWebConfig(raw: unknown): Promise<ActionResult> {
  const parsed = webConfigSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { slug, primaryColor, description, logoUrl, whatsappNumber } = parsed.data
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  // MERGE, no reemplazo: branding es un jsonb compartido. Escribir un objeto
  // nuevo borraria las claves que gestionan otras pantallas (hoy
  // resource_label, de Profesionales; mañana lo que venga).
  const { data: org } = await supabase
    .from('organizations')
    .select('branding')
    .eq('id', orgId)
    .single()

  const current =
    org?.branding && typeof org.branding === 'object' && !Array.isArray(org.branding)
      ? (org.branding as Record<string, unknown>)
      : {}

  const branding = {
    ...current,
    primary_color: primaryColor || null,
    description: description || null,
    logo_url: logoUrl || null,
    whatsapp_number: whatsappNumber || null,
  }

  const { error } = await supabase
    .from('organizations')
    .update({ web_slug: slug, branding })
    .eq('id', orgId)

  if (error) {
    if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
      return { ok: false, error: 'Ese enlace ya está en uso por otro negocio. Elige otro.' }
    }
    return { ok: false, error: 'No se pudo guardar la configuración.' }
  }
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}

const productSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  price: z.coerce.number().nonnegative().nullish(),
  description: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
})

export async function addProduct(raw: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { error } = await supabase.from('products').insert({
    organization_id: orgId,
    name: parsed.data.name,
    price: parsed.data.price ?? null,
    description: parsed.data.description || null,
    image_url: parsed.data.imageUrl || null,
  })
  if (error) return { ok: false, error: 'No se pudo guardar el producto.' }
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar el producto.' }
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}
