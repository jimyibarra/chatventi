import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type ChecklistItem = {
  key: string
  label: string
  hint: string
  href: string
  done: boolean
}

export type SetupChecklist = {
  items: ChecklistItem[]
  done: number
  total: number
  percent: number
}

// Deriva el checklist de onboarding del ESTADO REAL del negocio (RLS acota
// todas las consultas a la org del usuario autenticado).
export async function getSetupChecklist(
  supabase: SupabaseClient<Database>
): Promise<SetupChecklist> {
  const [services, hours, schedules, channels, agent, appointments] = await Promise.all([
    supabase.from('service_catalogs').select('*', { count: 'exact', head: true }),
    supabase.from('business_hours').select('*', { count: 'exact', head: true }),
    supabase.from('staff_schedules').select('*', { count: 'exact', head: true }),
    supabase.from('channels').select('*', { count: 'exact', head: true }),
    supabase.from('agent_configs').select('enabled').maybeSingle(),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
  ])

  const items: ChecklistItem[] = [
    {
      key: 'service',
      label: 'Crea tu primer servicio',
      hint: 'Lo que tus clientes pueden reservar (corte, consulta, sesión…).',
      href: '/dashboard/agenda/configuracion',
      done: (services.count ?? 0) > 0,
    },
    {
      key: 'hours',
      label: 'Define tu horario de atención',
      hint: 'Los días y horas en que tu negocio está abierto.',
      href: '/dashboard/agenda/configuracion',
      done: (hours.count ?? 0) > 0,
    },
    {
      key: 'availability',
      label: 'Configura la disponibilidad del equipo',
      hint: 'Sin esto la agenda no puede ofrecer horarios.',
      href: '/dashboard/agenda/configuracion',
      done: (schedules.count ?? 0) > 0,
    },
    {
      key: 'channel',
      label: 'Conecta tu WhatsApp',
      hint: 'Para que tus clientes te escriban y la IA los atienda.',
      href: '/dashboard/conexiones',
      done: (channels.count ?? 0) > 0,
    },
    {
      key: 'agent',
      label: 'Activa tu recepcionista IA',
      hint: 'Responde, agenda, reagenda y cancela por ti, 24/7.',
      href: '/dashboard/agente',
      done: Boolean(agent.data?.enabled),
    },
    {
      key: 'appointment',
      label: 'Registra tu primera cita',
      hint: 'Créala tú o deja que llegue sola por chat o reserva web.',
      href: '/dashboard/agenda',
      done: (appointments.count ?? 0) > 0,
    },
  ]

  const done = items.filter((i) => i.done).length
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  }
}
