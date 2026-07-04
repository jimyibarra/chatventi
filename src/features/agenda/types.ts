import { z } from 'zod'
import type { Tables } from '@/lib/supabase/database.types'

// -------------------------------------------------------------------
// Tipos de dominio (derivados de la BD)
// -------------------------------------------------------------------
export type Appointment = Tables<'appointments'>
export type ServiceCatalog = Tables<'service_catalogs'>
export type BusinessHour = Tables<'business_hours'>
export type StaffSchedule = Tables<'staff_schedules'>
export type Branch = Tables<'branches'>
export type Profile = Tables<'profiles'>
export type Client = Tables<'clients'>

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type Slot = { slot_start: string; slot_end: string; staff_id: string | null }

// Cita enriquecida para la UI (con datos de cliente/staff/servicios).
export type AppointmentView = Appointment & {
  client: Pick<Client, 'id' | 'name' | 'phone'> | null
  staff: Pick<Profile, 'id' | 'full_name'> | null
  services: Pick<ServiceCatalog, 'id' | 'name'>[]
}

// -------------------------------------------------------------------
// Constantes de presentacion
// -------------------------------------------------------------------
// weekday sigue EXTRACT(DOW) de Postgres: 0=Domingo .. 6=Sabado
export const WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; badge: string }
> = {
  scheduled: { label: 'Agendada', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  confirmed: { label: 'Confirmada', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  completed: { label: 'Completada', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelada', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  no_show: { label: 'No asistió', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
}

// -------------------------------------------------------------------
// Schemas Zod (validan la entrada de las Server Actions)
// -------------------------------------------------------------------
const uuid = z.string().uuid()
const isoDateTime = z.string().datetime({ offset: true })
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')

export const createAppointmentSchema = z.object({
  branchId: uuid,
  serviceIds: z.array(uuid).min(1, 'Selecciona al menos un servicio'),
  startsAt: isoDateTime,
  staffId: uuid.nullish(),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
})
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>

export const rescheduleSchema = z.object({
  appointmentId: uuid,
  newStartsAt: isoDateTime,
  newStaffId: uuid.nullish(),
})

export const statusSchema = z.object({
  appointmentId: uuid,
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']),
})

export const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  durationMinutes: z.coerce.number().int().positive().max(1440),
  price: z.coerce.number().nonnegative().nullish(),
  active: z.coerce.boolean().optional(),
})

export const businessHourSchema = z.object({
  branchId: uuid,
  weekday: z.coerce.number().int().min(0).max(6),
  openTime: hhmm,
  closeTime: hhmm,
  isClosed: z.coerce.boolean().optional(),
})

export const staffScheduleSchema = z.object({
  branchId: uuid,
  staffId: uuid,
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: hhmm,
  endTime: hhmm,
})
