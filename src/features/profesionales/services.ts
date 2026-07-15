import { createClient } from '@/lib/supabase/server'
import { DEFAULT_RESOURCE_LABEL, type ResourceView } from './types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

// Recursos de la org (RLS los acota) con sus servicios y su horario.
export async function getResources(supabase: ServerClient): Promise<ResourceView[]> {
  const { data } = await supabase
    .from('resources')
    .select('*, resource_services(service_id), staff_schedules(*)')
    .order('sort_order')
    .order('name')

  type Row = ResourceView & {
    resource_services: { service_id: string }[] | null
    staff_schedules: ResourceView['schedules'] | null
  }

  return ((data as Row[] | null) ?? []).map((row) => ({
    ...row,
    serviceIds: (row.resource_services ?? []).map((rs) => rs.service_id),
    schedules: [...(row.staff_schedules ?? [])].sort(
      (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
    ),
  }))
}

// Etiqueta del vertical. Vive en branding (jsonb) para no añadir columna.
export async function getResourceLabel(supabase: ServerClient): Promise<string> {
  const { data } = await supabase.from('organizations').select('branding').limit(1).maybeSingle()
  const branding = data?.branding
  if (branding && typeof branding === 'object' && !Array.isArray(branding)) {
    const label = (branding as Record<string, unknown>).resource_label
    if (typeof label === 'string' && label.trim() !== '') return label.trim()
  }
  return DEFAULT_RESOURCE_LABEL
}
