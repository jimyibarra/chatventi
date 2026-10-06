'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { BUSINESS_TEMPLATES } from '@/features/agente-ia/business-templates'
import { STARTER_HOURS, STARTER_SERVICES } from './starter-data'

export type QuickSetupResult = { ok: true; done: string[] } | { ok: false; error: string }

/**
 * "Te lo dejamos funcionando", sin que nadie tenga que hacerlo a mano.
 *
 * Deja el negocio en condiciones de agendar con valores típicos de su giro:
 * servicios, horario, un primer profesional y la recepcionista encendida con
 * su plantilla. Cada pieza se crea SOLO si falta: es seguro llamarlo dos veces
 * y nunca pisa lo que el dueño ya configuró.
 *
 * Corre con la sesión del usuario (la RLS limita todo a su organización y a
 * dueño/gerente). Lo que NO puede hacer nadie por el dueño es conectar su
 * WhatsApp: eso exige que él inicie sesión en Meta.
 */
export async function runQuickSetup(): Promise<QuickSetupResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  const orgId = profile?.organization_id
  if (!orgId || (profile.role !== 'owner' && profile.role !== 'manager')) {
    return { ok: false, error: 'Solo el dueño o un gerente pueden hacer esto.' }
  }
  const result = await seedOrganization(supabase, orgId, profile.full_name)
  if (result.ok) revalidatePath('/dashboard', 'layout')
  return result
}

/**
 * La siembra en sí, con el cliente que se le dé: la sesión del dueño (alta
 * normal) o service_role (alta por la API de socios, donde nadie ha iniciado
 * sesión todavía y la agenda debe funcionar desde el primer minuto).
 */
export async function seedOrganization(
  supabase: SupabaseClient<Database>,
  orgId: string,
  ownerName: string | null
): Promise<QuickSetupResult> {
  const [{ data: org }, { data: branch }] = await Promise.all([
    supabase.from('organizations').select('name, business_type').eq('id', orgId).maybeSingle(),
    supabase.from('branches').select('id').eq('organization_id', orgId).order('created_at').limit(1).maybeSingle(),
  ])
  if (!branch) return { ok: false, error: 'No encontramos tu sucursal.' }
  // Copias con tipo firme: dentro de las funciones de abajo TypeScript ya no
  // recuerda que estas dos no son nulas.
  const oid: string = orgId
  const branchId: string = branch.id

  const template = BUSINESS_TEMPLATES.find((t) => t.key === org?.business_type) ?? BUSINESS_TEMPLATES.find((t) => t.key === 'generico')
  const giro = template?.key ?? 'generico'
  const count = async (table: 'service_catalogs' | 'resources' | 'knowledge_base') =>
    (await supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', oid)).count ?? 0

  // Las cuatro piezas son independientes entre sí: van EN PARALELO para que
  // el negocio quede listo en una fracción del tiempo (si el dueño llega al
  // Panel a media preparación, ve pasos pendientes que en realidad ya vienen).

  // 1. Servicios típicos del giro.
  async function services(): Promise<string | null> {
    if ((await count('service_catalogs')) > 0) return null
    const list = STARTER_SERVICES[giro] ?? STARTER_SERVICES.generico
    const { error } = await supabase
      .from('service_catalogs')
      .insert(list.map((s) => ({ organization_id: oid, name: s.name, duration_minutes: s.minutes })))
    return error ? null : `${list.length} servicios de ejemplo`
  }

  // 2. Horario de atención.
  async function hours(): Promise<string | null> {
    const { count: existing } = await supabase
      .from('business_hours')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
    if ((existing ?? 0) > 0) return null
    const { error } = await supabase.from('business_hours').insert(
      Array.from({ length: 7 }, (_, weekday) => ({
        branch_id: branchId,
        weekday,
        open_time: STARTER_HOURS.open,
        close_time: STARTER_HOURS.close,
        is_closed: STARTER_HOURS.closedWeekdays.includes(weekday),
      }))
    )
    return error ? null : 'horario de lunes a sábado, 9:00 a 19:00'
  }

  // 3. Primer profesional, con el mismo horario. Sin él la agenda no puede
  //    ofrecer ni un hueco.
  async function professional(): Promise<string | null> {
    if ((await count('resources')) > 0) return null
    const name = ownerName?.trim().split(/\s+/)[0] || 'Yo'
    const { data: resource, error } = await supabase
      .from('resources')
      .insert({ organization_id: oid, branch_id: branchId, name })
      .select('id')
      .single()
    if (error || !resource) return null
    await supabase.from('staff_schedules').insert(
      [1, 2, 3, 4, 5, 6].map((weekday) => ({
        branch_id: branchId,
        resource_id: resource.id,
        weekday,
        start_time: STARTER_HOURS.open,
        end_time: STARTER_HOURS.close,
      }))
    )
    return `tu agenda como profesional (${name})`
  }

  // 4. Recepcionista: plantilla del giro, encendida. Solo si aún no existe su
  //    configuración: nunca se reenciende una que el dueño apagó.
  async function receptionist(): Promise<string | null> {
    if (!template) return null
    const { data: cfg } = await supabase
      .from('agent_configs')
      .select('organization_id')
      .eq('organization_id', oid)
      .maybeSingle()
    if (cfg) return null
    const { error } = await supabase.from('agent_configs').insert({
      organization_id: oid,
      enabled: true,
      system_prompt: template.prompt(org?.name ?? 'tu negocio'),
      updated_at: new Date().toISOString(),
    })
    if (error) return null
    if ((await count('knowledge_base')) === 0) {
      await supabase
        .from('knowledge_base')
        .insert(template.knowledge.map((content) => ({ organization_id: oid, content, source: 'plantilla' })))
    }
    return 'tu recepcionista encendida'
  }

  const done = (await Promise.all([services(), hours(), professional(), receptionist()])).filter(
    (x): x is string => x !== null
  )
  return { ok: true, done }
}
