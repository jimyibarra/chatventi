'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { removeMediaByUrl } from '@/features/storage/media'

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
  const { slug, primaryColor, description, whatsappNumber } = parsed.data
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

  // OJO: NO se toca `logo_url` aquí. El logo se sube/borra con `saveLogo`; si
  // este merge lo escribiera con un form que ya no lo manda, lo borraría.
  const branding = {
    ...current,
    primary_color: primaryColor || null,
    description: description || null,
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

// URL pública de nuestro bucket, o null para quitar. Persiste el logo aparte del
// resto del branding y borra el logo anterior si cambió.
const mediaUrlSchema = z.string().trim().url().nullable()

export async function saveLogo(rawUrl: string | null): Promise<ActionResult> {
  const parsed = mediaUrlSchema.safeParse(rawUrl)
  if (!parsed.success) return { ok: false, error: 'Imagen inválida.' }
  const url = parsed.data
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('branding')
    .eq('id', orgId)
    .single()
  const current =
    org?.branding && typeof org.branding === 'object' && !Array.isArray(org.branding)
      ? (org.branding as Record<string, unknown>)
      : {}
  const old = typeof current.logo_url === 'string' ? current.logo_url : null

  const { error } = await supabase
    .from('organizations')
    .update({ branding: { ...current, logo_url: url } })
    .eq('id', orgId)
  if (error) return { ok: false, error: 'No se pudo guardar el logo.' }

  if (old && old !== url) await removeMediaByUrl(old)
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}

// Foto de un producto (o null para quitarla). Borra la anterior si cambió.
export async function setProductImage(
  productId: string,
  rawUrl: string | null
): Promise<ActionResult> {
  const parsed = mediaUrlSchema.safeParse(rawUrl)
  if (!parsed.success) return { ok: false, error: 'Imagen inválida.' }
  const url = parsed.data
  const supabase = await createClient()
  // RLS: sólo devuelve el producto si es de la org del usuario.
  const { data: prod } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', productId)
    .maybeSingle()
  if (!prod) return { ok: false, error: 'Producto no encontrado.' }
  const old = prod.image_url

  const { error } = await supabase.from('products').update({ image_url: url }).eq('id', productId)
  if (error) return { ok: false, error: 'No se pudo guardar la imagen.' }

  if (old && old !== url) await removeMediaByUrl(old)
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}

const productSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  price: z.coerce.number().nonnegative().nullish(),
  description: z.string().trim().max(300).optional(),
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
  })
  if (error) return { ok: false, error: 'No se pudo guardar el producto.' }
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  // Lee la imagen ANTES de borrar la fila para limpiarla del Storage (cascada).
  const { data: prod } = await supabase.from('products').select('image_url').eq('id', id).maybeSingle()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return { ok: false, error: 'No se pudo eliminar el producto.' }
  if (prod?.image_url) await removeMediaByUrl(prod.image_url)
  revalidatePath('/dashboard/reservas-web')
  return { ok: true }
}
