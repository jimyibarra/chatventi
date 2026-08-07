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
})

export async function saveWebConfig(raw: unknown): Promise<ActionResult> {
  const parsed = webConfigSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { slug, primaryColor, description } = parsed.data
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
  // `whatsapp_number` dejó de editarse aquí (se retiró con el escaparate de
  // productos 2026-08-06); el merge conserva el valor existente sin tocarlo.
  const branding = {
    ...current,
    primary_color: primaryColor || null,
    description: description || null,
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

// El escaparate de productos se retiró el 2026-08-06 (decisión de Juan). Las
// acciones addProduct/deleteProduct/setProductImage vivían aquí; la tabla
// `products` y su RPC siguen en la base y se limpian en una fase contract
// posterior (respaldo en el chat de la sesión: products-backup-2026-08-06.json).
