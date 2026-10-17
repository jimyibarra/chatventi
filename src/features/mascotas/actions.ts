'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// =====================================================================
// Fase 3 (17-oct-2026): mascotas, cartilla de vacunas y recordatorio de
// servicio. Todo con la SESIÓN: la RLS (miembros de la organización) y el
// disparador pet_same_org blindan que nada cruce de negocio.
// =====================================================================

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.string().uuid()
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')

async function orgAndClient(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string): Promise<string | null> {
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return null
  const { data } = await supabase.from('clients').select('id').eq('id', clientId).eq('organization_id', orgId).maybeSingle()
  return data ? (orgId as string) : null
}

const petSchema = z.object({
  clientId: uuid,
  name: z.string().trim().min(1, 'Escribe su nombre').max(60),
  species: z.string().trim().max(40).optional(),
  breed: z.string().trim().max(60).optional(),
  sex: z.enum(['macho', 'hembra']).optional(),
  birthDate: ymd.optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function addPet(raw: unknown): Promise<ActionResult> {
  const parsed = petSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const p = parsed.data
  const supabase = await createClient()
  const orgId = await orgAndClient(supabase, p.clientId)
  if (!orgId) return { ok: false, error: 'No encontramos a ese cliente.' }
  const { error } = await supabase.from('pets').insert({
    organization_id: orgId,
    client_id: p.clientId,
    name: p.name,
    species: p.species || null,
    breed: p.breed || null,
    sex: p.sex ?? null,
    birth_date: p.birthDate ?? null,
    notes: p.notes || null,
  })
  if (error) return { ok: false, error: 'No se pudo guardar la mascota.' }
  revalidatePath(`/dashboard/clientes/${p.clientId}`)
  return { ok: true }
}

/** Dar de baja una mascota (se conserva su historial). */
export async function archivePet(petId: string, clientId: string): Promise<ActionResult> {
  if (!uuid.safeParse(petId).success) return { ok: false, error: 'Datos inválidos' }
  const supabase = await createClient()
  const { error } = await supabase.from('pets').update({ active: false }).eq('id', petId)
  if (error) return { ok: false, error: 'No se pudo dar de baja.' }
  await supabase.from('client_reminders').update({ active: false }).eq('pet_id', petId)
  revalidatePath(`/dashboard/clientes/${clientId}`)
  return { ok: true }
}

const vaccineSchema = z
  .object({
    petId: uuid,
    clientId: uuid,
    name: z.string().trim().min(1, 'Escribe la vacuna').max(80),
    appliedOn: ymd,
    nextDueOn: ymd.optional(),
  })
  .refine((v) => !v.nextDueOn || v.nextDueOn > v.appliedOn, 'La próxima dosis va después de la aplicada')

/**
 * Registra una vacuna en la cartilla. Con próxima dosis, deja el recordatorio
 * (de una sola vez, a las 10:00 de ese día) con el nombre de la mascota.
 */
export async function addVaccine(raw: unknown): Promise<ActionResult> {
  const parsed = vaccineSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const v = parsed.data
  const supabase = await createClient()
  const { data: pet } = await supabase.from('pets').select('id, name, organization_id, client_id').eq('id', v.petId).maybeSingle()
  if (!pet || pet.client_id !== v.clientId) return { ok: false, error: 'No encontramos a esa mascota.' }
  const { error } = await supabase.from('pet_vaccines').insert({
    organization_id: pet.organization_id,
    pet_id: pet.id,
    name: v.name,
    applied_on: v.appliedOn,
    next_due_on: v.nextDueOn ?? null,
  })
  if (error) return { ok: false, error: 'No se pudo guardar la vacuna.' }
  if (v.nextDueOn) {
    // Solo un aviso pendiente por mascota y vacuna: el nuevo reemplaza al anterior.
    const message = `A ${pet.name} le toca su vacuna ${v.name}. ¿Te agendo su cita?`
    await supabase.from('client_reminders').update({ active: false }).eq('pet_id', pet.id).eq('source', 'vaccine').ilike('message', `%vacuna ${v.name}.%`)
    const days = Math.max(1, Math.round((Date.parse(v.nextDueOn) - Date.parse(v.appliedOn)) / 86_400_000))
    await supabase.from('client_reminders').insert({
      organization_id: pet.organization_id,
      client_id: pet.client_id,
      pet_id: pet.id,
      message,
      interval_days: Math.min(days, 3650),
      next_due_at: `${v.nextDueOn}T10:00:00-06:00`,
      active: true,
      repeat: false,
      source: 'vaccine',
    })
  }
  revalidatePath(`/dashboard/clientes/${v.clientId}`)
  return { ok: true }
}

export async function deleteVaccine(vaccineId: string, clientId: string): Promise<ActionResult> {
  if (!uuid.safeParse(vaccineId).success) return { ok: false, error: 'Datos inválidos' }
  const supabase = await createClient()
  const { data: vac } = await supabase.from('pet_vaccines').select('id, pet_id, name').eq('id', vaccineId).maybeSingle()
  if (!vac) return { ok: false, error: 'No encontramos esa vacuna.' }
  const { error } = await supabase.from('pet_vaccines').delete().eq('id', vaccineId)
  if (error) return { ok: false, error: 'No se pudo borrar.' }
  await supabase.from('client_reminders').update({ active: false }).eq('pet_id', vac.pet_id).eq('source', 'vaccine').ilike('message', `%vacuna ${vac.name}.%`)
  revalidatePath(`/dashboard/clientes/${clientId}`)
  return { ok: true }
}

const followupSchema = z.object({
  serviceId: uuid,
  days: z.coerce.number().int().min(1).max(3650).nullable(),
  message: z.string().trim().max(300).optional(),
})

/** «Recordar volver en N días» de un servicio (null lo apaga). Dueño o gerente (RLS de servicios). */
export async function saveServiceFollowup(raw: unknown): Promise<ActionResult> {
  const parsed = followupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Escribe un número de días entre 1 y 3650.' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_catalogs')
    .update({ followup_days: parsed.data.days, followup_message: parsed.data.days ? parsed.data.message || null : null })
    .eq('id', parsed.data.serviceId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}
