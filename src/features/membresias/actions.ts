'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { REMINDER_DAYS_BEFORE, addDays, endsOn, renewalStart, todayMx } from './logic'

// =====================================================================
// Membresías (fase 4, 17-oct-2026). Todo con la SESIÓN: la RLS acota a la
// organización (planes: dueño o gerente; membresías y pagos: el equipo) y los
// disparadores impiden mezclar clientes o planes de otro negocio.
// =====================================================================

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.string().uuid()
const money = z.coerce.number().min(0).max(1_000_000)

function revalidate(clientId?: string) {
  revalidatePath('/dashboard/membresias')
  if (clientId) revalidatePath(`/dashboard/clientes/${clientId}`)
}

const planSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del plan').max(60),
  durationDays: z.coerce.number().int().min(1, 'Duración de 1 día o más').max(3650),
  price: money.nullable(),
})

export async function addPlan(raw: unknown): Promise<ActionResult> {
  const parsed = planSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { error } = await supabase.from('membership_plans').insert({
    organization_id: orgId as string,
    name: parsed.data.name,
    duration_days: parsed.data.durationDays,
    price: parsed.data.price,
  })
  if (error) return { ok: false, error: 'No se pudo guardar el plan (solo el dueño o un gerente).' }
  revalidate()
  return { ok: true }
}

export async function archivePlan(planId: string): Promise<ActionResult> {
  if (!uuid.safeParse(planId).success) return { ok: false, error: 'Datos inválidos' }
  const supabase = await createClient()
  const { error } = await supabase.from('membership_plans').update({ active: false }).eq('id', planId)
  if (error) return { ok: false, error: 'No se pudo quitar el plan.' }
  revalidate()
  return { ok: true }
}

const startSchema = z.object({
  clientId: uuid,
  planId: uuid,
  amount: money.nullable(),
  method: z.enum(['efectivo', 'tarjeta', 'transferencia', 'otro']).default('efectivo'),
})

/**
 * Alta o renovación: la membresía empieza al día siguiente de la vigente (o hoy
 * si ya venció), registra el pago y deja el aviso de vencimiento (de una vez,
 * unos días antes). La renovación reemplaza el aviso anterior.
 */
export async function startMembership(raw: unknown): Promise<ActionResult> {
  const parsed = startSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const p = parsed.data
  const supabase = await createClient()
  const [{ data: plan }, { data: last }] = await Promise.all([
    supabase.from('membership_plans').select('id, organization_id, name, duration_days, price').eq('id', p.planId).eq('active', true).maybeSingle(),
    supabase.from('memberships').select('ends_on').eq('client_id', p.clientId).is('cancelled_at', null).order('ends_on', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!plan) return { ok: false, error: 'Ese plan ya no existe.' }

  const today = todayMx()
  const starts = renewalStart(last?.ends_on ?? null, today)
  const ends = endsOn(starts, plan.duration_days)
  const { data: membership, error } = await supabase
    .from('memberships')
    .insert({
      organization_id: plan.organization_id,
      client_id: p.clientId,
      plan_id: plan.id,
      plan_name: plan.name,
      price: plan.price,
      starts_on: starts,
      ends_on: ends,
    })
    .select('id')
    .maybeSingle()
  if (error || !membership) return { ok: false, error: 'No se pudo registrar la membresía.' }

  if (p.amount && p.amount > 0) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('membership_payments').insert({
      organization_id: plan.organization_id,
      membership_id: membership.id,
      amount: p.amount,
      method: p.method,
      paid_on: today,
      created_by: user?.id ?? null,
    })
  }

  // Aviso de vencimiento: solo para planes de una semana o más.
  await supabase.from('client_reminders').update({ active: false }).eq('client_id', p.clientId).eq('source', 'membership').eq('active', true)
  if (plan.duration_days >= 7) {
    const remindOn = addDays(ends, -REMINDER_DAYS_BEFORE)
    const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${ends}T12:00:00Z`))
    await supabase.from('client_reminders').insert({
      organization_id: plan.organization_id,
      client_id: p.clientId,
      message: `Tu ${plan.name.toLowerCase()} vence el ${fecha}. ¿Te la renovamos? Respóndenos por aquí.`,
      interval_days: plan.duration_days,
      next_due_at: `${remindOn > today ? remindOn : addDays(today, 1)}T10:00:00-06:00`,
      active: true,
      repeat: false,
      source: 'membership',
    })
  }
  revalidate(p.clientId)
  return { ok: true }
}

export async function cancelMembership(membershipId: string, clientId: string): Promise<ActionResult> {
  if (!uuid.safeParse(membershipId).success) return { ok: false, error: 'Datos inválidos' }
  const supabase = await createClient()
  const { error } = await supabase.from('memberships').update({ cancelled_at: new Date().toISOString() }).eq('id', membershipId)
  if (error) return { ok: false, error: 'No se pudo cancelar.' }
  await supabase.from('client_reminders').update({ active: false }).eq('client_id', clientId).eq('source', 'membership').eq('active', true)
  revalidate(clientId)
  return { ok: true }
}
