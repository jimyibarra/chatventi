'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { removeMediaByUrl } from '@/features/storage/media'
import {
  resourceSchema,
  resourceServicesSchema,
  resourceScheduleSchema,
  resourceLabelSchema,
} from './types'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

function humanizeError(message: string): string {
  if (message.includes('resources_profile_uniq')) return 'Esa persona ya está vinculada a otro profesional.'
  if (message.includes('forbidden')) return 'No tienes permiso para hacer esto.'
  if (message.includes('violates row-level security')) return 'No tienes permiso para hacer esto.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

const PATH = '/dashboard/profesionales'

// Revalidamos tambien agenda y reservas-web: el profesional aparece en ambas.
function revalidateAll() {
  revalidatePath(PATH)
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/reservas-web')
}

// -------------------------------------------------------------------
// Alta / edicion de profesional (SIN crear cuenta de usuario)
// -------------------------------------------------------------------
export async function saveResource(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = resourceSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { id, name, branchId, active } = parsed.data
  const supabase = await createClient()

  if (id) {
    // La foto NO se toca aquí (la gestiona setResourcePhoto).
    const { error } = await supabase
      .from('resources')
      .update({
        name,
        branch_id: branchId ?? null,
        active: active ?? true,
      })
      .eq('id', id)
    if (error) return { ok: false, error: humanizeError(error.message) }
    revalidateAll()
    return { ok: true, data: { id } }
  }

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }

  const { data, error } = await supabase
    .from('resources')
    .insert({
      organization_id: orgId,
      name,
      branch_id: branchId ?? null,
      active: active ?? true,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true, data: { id: data.id } }
}

// Foto del profesional (o null para quitarla). Subida desde el dispositivo:
// la URL viene del bucket `media`. Borra la anterior si cambió.
const mediaUrlSchema = z.string().trim().url().nullable()

export async function setResourcePhoto(
  resourceId: string,
  rawUrl: string | null
): Promise<ActionResult> {
  const parsed = mediaUrlSchema.safeParse(rawUrl)
  if (!parsed.success) return { ok: false, error: 'Imagen inválida.' }
  const url = parsed.data
  const supabase = await createClient()
  // RLS: sólo devuelve el recurso si es de la org del usuario.
  const { data: res } = await supabase
    .from('resources')
    .select('photo_url')
    .eq('id', resourceId)
    .maybeSingle()
  if (!res) return { ok: false, error: 'Profesional no encontrado.' }
  const old = res.photo_url

  const { error } = await supabase.from('resources').update({ photo_url: url }).eq('id', resourceId)
  if (error) return { ok: false, error: humanizeError(error.message) }

  if (old && old !== url) await removeMediaByUrl(old)
  revalidateAll()
  return { ok: true }
}

// Desactivar en vez de borrar: el historial de citas apunta al recurso.
export async function deactivateResource(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('resources').update({ active: false }).eq('id', id)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true }
}

export async function reactivateResource(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('resources').update({ active: true }).eq('id', id)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true }
}

// -------------------------------------------------------------------
// Servicios que presta el profesional (reemplaza el set completo)
//
// OJO (regla del motor, Fase 2): un recurso SIN filas aqui presta TODOS
// los servicios. Vaciar la lista NO lo deja sin servicios: lo deja
// prestandolos todos. La UI lo advierte.
// -------------------------------------------------------------------
export async function setResourceServices(raw: unknown): Promise<ActionResult> {
  const parsed = resourceServicesSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { resourceId, serviceIds } = parsed.data
  const supabase = await createClient()

  const { error: delError } = await supabase
    .from('resource_services')
    .delete()
    .eq('resource_id', resourceId)
  if (delError) return { ok: false, error: humanizeError(delError.message) }

  if (serviceIds.length > 0) {
    const { error } = await supabase
      .from('resource_services')
      .insert(serviceIds.map((service_id) => ({ resource_id: resourceId, service_id })))
    if (error) return { ok: false, error: humanizeError(error.message) }
  }
  revalidateAll()
  return { ok: true }
}

// -------------------------------------------------------------------
// Horario individual del profesional
//   staff_id se deja NULL a proposito: el profesional no tiene cuenta.
// -------------------------------------------------------------------
export async function addResourceSchedule(raw: unknown): Promise<ActionResult> {
  const parsed = resourceScheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { branchId, resourceId, weekday, startTime, endTime } = parsed.data
  if (endTime <= startTime) {
    return { ok: false, error: 'La hora de fin debe ser mayor a la de inicio.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('staff_schedules').insert({
    branch_id: branchId,
    resource_id: resourceId,
    weekday,
    start_time: startTime,
    end_time: endTime,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true }
}

export async function deleteResourceSchedule(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('staff_schedules').delete().eq('id', id)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true }
}

// -------------------------------------------------------------------
// Etiqueta del vertical (branding.resource_label)
//
// MERGE, nunca reemplazo: branding es un jsonb compartido con la config
// de Reservas Web (color, logo, descripcion). Escribir un objeto nuevo
// borraria esas claves.
// -------------------------------------------------------------------
export async function saveResourceLabel(raw: unknown): Promise<ActionResult> {
  const parsed = resourceLabelSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
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

  const { error } = await supabase
    .from('organizations')
    .update({ branding: { ...current, resource_label: parsed.data.label } })
    .eq('id', orgId)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidateAll()
  return { ok: true }
}
