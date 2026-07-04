'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createAppointmentSchema,
  rescheduleSchema,
  statusSchema,
  serviceSchema,
  businessHourSchema,
  staffScheduleSchema,
  type Slot,
} from './types'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// Traduce errores crudos del RPC a mensajes de usuario.
function humanizeError(message: string): string {
  if (message.includes('slot_taken')) return 'Ese horario ya está ocupado. Elige otro.'
  if (message.includes('invalid_services')) return 'Servicio inválido o inactivo.'
  if (message.includes('branch_not_found')) return 'Sucursal no encontrada.'
  if (message.includes('forbidden')) return 'No tienes acceso a este recurso.'
  if (message.includes('appointment_not_found')) return 'La cita ya no existe.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

const AGENDA_PATH = '/dashboard/agenda'

// -------------------------------------------------------------------
// Disponibilidad (lectura invocada desde el cliente al elegir fecha)
// -------------------------------------------------------------------
export async function fetchSlots(input: {
  branchId: string
  serviceIds: string[]
  date: string // YYYY-MM-DD
  staffId?: string | null
  slotInterval?: number
}): Promise<ActionResult<Slot[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_date: input.date,
    p_staff_id: input.staffId ?? undefined,
    p_slot_interval: input.slotInterval ?? 15,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  return { ok: true, data: (data ?? []) as Slot[] }
}

// -------------------------------------------------------------------
// Crear cita (upsert de cliente opcional por teléfono)
// -------------------------------------------------------------------
export async function createAppointment(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAppointmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const input = parsed.data
  const supabase = await createClient()

  // Upsert del cliente por teléfono dentro de la org (si se proporcionó).
  let clientId: string | null = null
  if (input.clientPhone && input.clientPhone.length > 0) {
    const { data: orgId } = await supabase.rpc('get_my_org')
    if (orgId) {
      const { data: client } = await supabase
        .from('clients')
        .upsert(
          {
            organization_id: orgId,
            phone: input.clientPhone,
            name: input.clientName || null,
          },
          { onConflict: 'organization_id,phone' }
        )
        .select('id')
        .single()
      clientId = client?.id ?? null
    }
  }

  const { data, error } = await supabase.rpc('create_appointment', {
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_starts_at: input.startsAt,
    p_client_id: clientId ?? undefined,
    p_staff_id: input.staffId ?? undefined,
    p_source: 'staff',
    p_notes: input.notes || undefined,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(AGENDA_PATH)
  return { ok: true, data: { id: data as string } }
}

// -------------------------------------------------------------------
// Reagendar / mover cita
// -------------------------------------------------------------------
export async function rescheduleAppointment(raw: unknown): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('reschedule_appointment', {
    p_appointment_id: parsed.data.appointmentId,
    p_new_starts_at: parsed.data.newStartsAt,
    p_new_staff_id: parsed.data.newStaffId ?? undefined,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(AGENDA_PATH)
  return { ok: true }
}

// -------------------------------------------------------------------
// Cambiar estado (confirmar / completar / no_show / cancelar)
// -------------------------------------------------------------------
export async function setAppointmentStatus(raw: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_appointment_status', {
    p_appointment_id: parsed.data.appointmentId,
    p_status: parsed.data.status,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(AGENDA_PATH)
  return { ok: true }
}

// -------------------------------------------------------------------
// Catálogo de servicios (crear/editar/eliminar)
// -------------------------------------------------------------------
export async function saveService(raw: unknown): Promise<ActionResult> {
  const parsed = serviceSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const supabase = await createClient()
  const { id, name, durationMinutes, price, active } = parsed.data

  if (id) {
    const { error } = await supabase
      .from('service_catalogs')
      .update({
        name,
        duration_minutes: durationMinutes,
        price: price ?? null,
        active: active ?? true,
      })
      .eq('id', id)
    if (error) return { ok: false, error: humanizeError(error.message) }
  } else {
    const { data: orgId } = await supabase.rpc('get_my_org')
    if (!orgId) return { ok: false, error: 'No tienes una organización.' }
    const { error } = await supabase.from('service_catalogs').insert({
      organization_id: orgId,
      name,
      duration_minutes: durationMinutes,
      price: price ?? null,
      active: active ?? true,
    })
    if (error) return { ok: false, error: humanizeError(error.message) }
  }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

export async function deleteService(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  // Preferimos desactivar en vez de borrar (historial de citas usa el servicio).
  const { error } = await supabase
    .from('service_catalogs')
    .update({ active: false })
    .eq('id', id)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

// -------------------------------------------------------------------
// Horario de la sucursal (upsert por día de semana)
// -------------------------------------------------------------------
export async function saveBusinessHour(raw: unknown): Promise<ActionResult> {
  const parsed = businessHourSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { branchId, weekday, openTime, closeTime, isClosed } = parsed.data
  if (!isClosed && closeTime <= openTime) {
    return { ok: false, error: 'La hora de cierre debe ser mayor a la de apertura.' }
  }
  const supabase = await createClient()

  // Reemplazamos la fila del día (una fila por weekday).
  await supabase
    .from('business_hours')
    .delete()
    .eq('branch_id', branchId)
    .eq('weekday', weekday)
  const { error } = await supabase.from('business_hours').insert({
    branch_id: branchId,
    weekday,
    open_time: openTime,
    close_time: closeTime,
    is_closed: isClosed ?? false,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

// -------------------------------------------------------------------
// Disponibilidad del staff (agregar/eliminar bloques)
// -------------------------------------------------------------------
export async function addStaffSchedule(raw: unknown): Promise<ActionResult> {
  const parsed = staffScheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { branchId, staffId, weekday, startTime, endTime } = parsed.data
  if (endTime <= startTime) {
    return { ok: false, error: 'La hora de fin debe ser mayor a la de inicio.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('staff_schedules').insert({
    branch_id: branchId,
    staff_id: staffId,
    weekday,
    start_time: startTime,
    end_time: endTime,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}

export async function deleteStaffSchedule(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('staff_schedules').delete().eq('id', id)
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true }
}
