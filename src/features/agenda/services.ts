import { createClient } from '@/lib/supabase/server'
import type {
  AppointmentView,
  Branch,
  BusinessHour,
  ServiceCatalog,
  Profile,
} from './types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

// Sucursales de la org (RLS las acota).
export async function getBranches(supabase: ServerClient): Promise<Branch[]> {
  const { data } = await supabase.from('branches').select('*').order('created_at')
  return data ?? []
}

// Catálogo de servicios.
export async function getServices(
  supabase: ServerClient,
  opts?: { onlyActive?: boolean }
): Promise<ServiceCatalog[]> {
  let q = supabase.from('service_catalogs').select('*').order('name')
  if (opts?.onlyActive) q = q.eq('active', true)
  const { data } = await q
  return data ?? []
}

// Miembros del equipo (profiles con cuenta). Ya NO define quién atiende:
// eso son los recursos (ver features/profesionales).
export async function getStaff(supabase: ServerClient): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name')
  return data ?? []
}

export async function getBusinessHours(
  supabase: ServerClient,
  branchId: string
): Promise<BusinessHour[]> {
  const { data } = await supabase
    .from('business_hours')
    .select('*')
    .eq('branch_id', branchId)
    .order('weekday')
  return data ?? []
}

// Citas de una sucursal en un rango [from, to) con cliente/profesional/servicios.
export async function getAppointmentsRange(
  supabase: ServerClient,
  branchId: string,
  fromISO: string,
  toISO: string
): Promise<AppointmentView[]> {
  const { data } = await supabase
    .from('appointments')
    .select(
      `*,
       client:clients(id, name, phone),
       resource:resources(id, name),
       appointment_services(service:service_catalogs(id, name))`
    )
    .eq('branch_id', branchId)
    .gte('starts_at', fromISO)
    .lt('starts_at', toISO)
    .order('starts_at')

  type Row = AppointmentView & {
    appointment_services: { service: { id: string; name: string } | null }[] | null
  }

  return ((data as Row[] | null) ?? []).map((row) => ({
    ...row,
    services: (row.appointment_services ?? [])
      .map((as) => as.service)
      .filter((s): s is { id: string; name: string } => s !== null),
  }))
}
