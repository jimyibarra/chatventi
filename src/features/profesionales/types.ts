import { z } from 'zod'
import type { Tables } from '@/lib/supabase/database.types'

// -------------------------------------------------------------------
// Tipos de dominio
// -------------------------------------------------------------------
export type Resource = Tables<'resources'>
export type StaffSchedule = Tables<'staff_schedules'>

// Recurso enriquecido para la UI: qué servicios presta y su horario.
export type ResourceView = Resource & {
  serviceIds: string[]
  schedules: StaffSchedule[]
}

// -------------------------------------------------------------------
// Etiqueta por vertical (organizations.branding.resource_label)
//   Una peluquería tiene "Profesionales"; un centro de estética, "Salas";
//   un club de pádel, "Canchas". El modelo es el mismo recurso.
// -------------------------------------------------------------------
export const DEFAULT_RESOURCE_LABEL = 'Profesionales'

export const RESOURCE_LABEL_PRESETS = [
  { value: 'Profesionales', hint: 'Peluquería, clínica, barbería' },
  { value: 'Salas', hint: 'Consultorios, cabinas, estudios' },
  { value: 'Equipos', hint: 'Máquinas, canchas, mesas' },
] as const

// "Profesionales" -> "Profesional" · "Salas" -> "Sala" · "Equipos" -> "Equipo"
// Heurística deliberadamente simple: la etiqueta la escribe el dueño y solo
// se usa para rotular botones ("Añadir profesional").
export function toSingular(label: string): string {
  const l = label.trim()
  if (l.length < 3) return l
  if (/es$/i.test(l)) return l.slice(0, -2)
  if (/s$/i.test(l)) return l.slice(0, -1)
  return l
}

// -------------------------------------------------------------------
// Schemas Zod
// -------------------------------------------------------------------
const uuid = z.string().uuid()
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')

export const resourceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  // v1: URL de texto. La subida a Storage es la fase de Branding del roadmap.
  photoUrl: z.string().trim().url('URL de foto inválida.').optional().or(z.literal('')),
  branchId: uuid.nullish(),
  active: z.coerce.boolean().optional(),
})
export type ResourceInput = z.infer<typeof resourceSchema>

export const resourceServicesSchema = z.object({
  resourceId: uuid,
  serviceIds: z.array(uuid),
})

export const resourceScheduleSchema = z.object({
  branchId: uuid,
  resourceId: uuid,
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: hhmm,
  endTime: hhmm,
})

export const resourceLabelSchema = z.object({
  label: z.string().trim().min(1, 'La etiqueta no puede estar vacía').max(40),
})
