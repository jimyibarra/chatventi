'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// =====================================================================
// Ficha clínica (fase 5, 17-oct-2026). Todo con la SESIÓN: la RLS deja leer y
// escribir solo a dueño y gerente, el consentimiento no se puede reescribir y
// las notas solo se agregan (no hay permiso de editar ni borrar).
// =====================================================================

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.string().uuid()
const text = (max: number) => z.string().trim().max(max).optional()
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')

const fields = {
  reason: text(1000),
  allergies: text(1000),
  conditions: text(2000),
  medications: text(1000),
  notes: text(2000),
}

const createSchema = z.object({
  clientId: uuid,
  consent: z.literal(true, { message: 'Registra primero el consentimiento del paciente.' }),
  consentMethod: z.enum(['firma_papel', 'firma_digital', 'otro']),
  ...fields,
})

const clean = (v?: string) => (v && v.length > 0 ? v : null)

/** Primera vez: consentimiento + formulario. Sin consentimiento no se guarda nada. */
export async function createClinicalProfile(raw: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const p = parsed.data
  const supabase = await createClient()
  const [{ data: orgId }, { data: { user } }] = await Promise.all([supabase.rpc('get_my_org'), supabase.auth.getUser()])
  if (!orgId || !user) return { ok: false, error: 'Tu sesión terminó.' }
  const { error } = await supabase.from('clinical_profiles').insert({
    organization_id: orgId as string,
    client_id: p.clientId,
    reason: clean(p.reason),
    allergies: clean(p.allergies),
    conditions: clean(p.conditions),
    medications: clean(p.medications),
    notes: clean(p.notes),
    consent_at: new Date().toISOString(),
    consent_method: p.consentMethod,
    consent_by: user.id,
  })
  if (error) return { ok: false, error: error.code === '23505' ? 'Este paciente ya tiene ficha.' : 'No se pudo guardar (solo el dueño o un gerente).' }
  revalidatePath(`/dashboard/clientes/${p.clientId}`)
  return { ok: true }
}

const updateSchema = z.object({ clientId: uuid, ...fields })

export async function updateClinicalProfile(raw: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const p = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clinical_profiles')
    .update({
      reason: clean(p.reason),
      allergies: clean(p.allergies),
      conditions: clean(p.conditions),
      medications: clean(p.medications),
      notes: clean(p.notes),
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', p.clientId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath(`/dashboard/clientes/${p.clientId}`)
  return { ok: true }
}

const noteSchema = z
  .object({
    clientId: uuid,
    note: z.string().trim().min(1, 'Escribe la nota').max(4000),
    occurredOn: ymd,
    nextControlOn: ymd.optional(),
  })
  .refine((v) => !v.nextControlOn || v.nextControlOn > v.occurredOn, 'El próximo control va después de la consulta')

/**
 * Nota de consulta (solo se agrega). Con «próximo control» deja un aviso por
 * WhatsApp ese día; el aviso no lleva nada clínico, solo la invitación.
 */
export async function addClinicalNote(raw: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const n = parsed.data
  const supabase = await createClient()
  const [{ data: orgId }, { data: { user } }] = await Promise.all([supabase.rpc('get_my_org'), supabase.auth.getUser()])
  if (!orgId || !user) return { ok: false, error: 'Tu sesión terminó.' }
  const { error } = await supabase.from('clinical_notes').insert({
    organization_id: orgId as string,
    client_id: n.clientId,
    note: n.note,
    occurred_on: n.occurredOn,
    next_control_on: n.nextControlOn ?? null,
    created_by: user.id,
  })
  if (error) return { ok: false, error: 'No se pudo guardar la nota (solo el dueño o un gerente).' }
  if (n.nextControlOn) {
    await supabase.from('client_reminders').update({ active: false }).eq('client_id', n.clientId).eq('source', 'clinical').eq('active', true)
    await supabase.from('client_reminders').insert({
      organization_id: orgId as string,
      client_id: n.clientId,
      message: 'Ya te toca tu cita de control. ¿Te la agendo?',
      interval_days: Math.max(1, Math.round((Date.parse(n.nextControlOn) - Date.parse(n.occurredOn)) / 86_400_000)),
      next_due_at: `${n.nextControlOn}T10:00:00-06:00`,
      active: true,
      repeat: false,
      source: 'clinical',
    })
  }
  revalidatePath(`/dashboard/clientes/${n.clientId}`)
  return { ok: true }
}
