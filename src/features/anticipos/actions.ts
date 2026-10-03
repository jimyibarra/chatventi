'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { DEPOSIT_NEXT, isDepositStatus } from './labels'

type Result = { ok: true } | { ok: false; error: string }

const settingsSchema = z.object({
  bankDetails: z.string().trim().max(600),
  holdMinutes: z.coerce.number().int().min(15).max(1440),
  cancelHours: z.coerce.number().int().min(0).max(168),
})

/** Datos de pago y reglas del anticipo. Solo el dueño (la RLS lo impone). */
export async function saveDepositSettings(raw: unknown): Promise<Result> {
  const parsed = settingsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Revisa los datos: plazo entre 15 minutos y 24 horas.' }
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) return { ok: false, error: 'No tienes una organización.' }
  const { data, error } = await supabase
    .from('organizations')
    .update({
      deposit_bank_details: parsed.data.bankDetails || null,
      deposit_hold_minutes: parsed.data.holdMinutes,
      deposit_cancel_hours: parsed.data.cancelHours,
    })
    .eq('id', orgId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'Solo el dueño puede cambiar esto.' }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

const serviceSchema = z
  .object({
    serviceId: z.string().uuid(),
    type: z.enum(['none', 'fixed', 'percent']),
    value: z.coerce.number().positive().max(100000).nullable(),
  })
  .refine((v) => v.type === 'none' || (v.value !== null && (v.type !== 'percent' || v.value <= 100)), {
    message: 'Escribe un monto, o un porcentaje entre 1 y 100.',
  })

/** Anticipo de un servicio: ninguno, un monto fijo o un porcentaje del precio. */
export async function saveServiceDeposit(raw: unknown): Promise<Result> {
  const parsed = serviceSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const { serviceId, type, value } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_catalogs')
    .update({ deposit_type: type, deposit_value: type === 'none' ? null : value })
    .eq('id', serviceId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'No se pudo guardar el anticipo.' }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

const statusSchema = z.object({ appointmentId: z.string().uuid(), to: z.string() })

/** Mueve el anticipo de una cita a mano, solo por las transiciones permitidas. */
export async function setDepositStatus(raw: unknown): Promise<Result> {
  const parsed = statusSchema.safeParse(raw)
  if (!parsed.success || !isDepositStatus(parsed.data.to)) return { ok: false, error: 'Datos inválidos' }
  const supabase = await createClient()
  const { data: appt } = await supabase
    .from('appointments')
    .select('deposit_status')
    .eq('id', parsed.data.appointmentId)
    .maybeSingle()
  const from = appt?.deposit_status
  if (!isDepositStatus(from) || !DEPOSIT_NEXT[from].some((t) => t.to === parsed.data.to)) {
    return { ok: false, error: 'Ese cambio ya no aplica. Recarga la página.' }
  }
  const { data, error } = await supabase
    .from('appointments')
    .update({ deposit_status: parsed.data.to, deposit_updated_at: new Date().toISOString() })
    .eq('id', parsed.data.appointmentId)
    .eq('deposit_status', from) // nadie lo cambió mientras tanto
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'No se pudo actualizar el anticipo.' }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/agenda')
  return { ok: true }
}
