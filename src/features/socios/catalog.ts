import 'server-only'
import { NextResponse } from 'next/server'
import type { Json } from '@/lib/supabase/database.types'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { STARTER_HOURS } from '@/features/onboarding/starter-data'
import { apiError } from './service'

// Catálogo administrado por el socio: PASEN manda la lista completa de
// servicios y el horario de la sucursal; aquí se reemplaza lo anterior. Los
// servicios que ya no vienen se desactivan (nunca se borran: tienen citas).

type Service = SupabaseClient<Database>

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const serviceSchema = z.object({
  externalId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(600),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  priceText: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().default(true),
  position: z.number().int().min(0).max(10_000).default(0),
})

const hourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens: z.string().regex(HHMM, 'Hora HH:MM').nullable().optional(),
    closes: z.string().regex(HHMM, 'Hora HH:MM').nullable().optional(),
    closed: z.boolean().default(false),
  })
  .refine((h) => h.closed || (h.opens && h.closes && h.opens < h.closes), 'Un día abierto necesita opens < closes')

export const catalogSchema = z
  .object({
    services: z.array(serviceSchema).max(100).optional(),
    hours: z.array(hourSchema).length(7).optional(),
    /** Color de la página del negocio (#rrggbb): tiñe su agenda pública. */
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'brandColor debe ser #rrggbb').optional(),
  })
  .refine((c) => c.services || c.hours || c.brandColor, 'Manda services, hours, brandColor o varios')
  .refine((c) => !c.hours || new Set(c.hours.map((h) => h.weekday)).size === 7, 'hours debe traer los 7 días, sin repetir')
  .refine((c) => !c.services || new Set(c.services.map((s) => s.externalId)).size === c.services.length, 'externalId repetido')

export type CatalogInput = z.infer<typeof catalogSchema>

type HourRow = { weekday: number; open_time: string; close_time: string; is_closed: boolean }
type ScheduleRow = { weekday: number; start_time: string; end_time: string }

const hm = (t: string) => t.slice(0, 5)

/** Horario del profesional sembrado por el alta (lunes a sábado, 9–19). */
const SEED_SCHEDULE: ScheduleRow[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_time: STARTER_HOURS.open, end_time: STARTER_HOURS.close }))

function sameSchedule(a: ScheduleRow[], b: ScheduleRow[]): boolean {
  const key = (rows: ScheduleRow[]) => rows.map((r) => `${r.weekday}:${hm(r.start_time)}-${hm(r.end_time)}`).sort().join('|')
  return key(a) === key(b)
}

/** Lo que un horario de sucursal implica para un profesional: solo los días abiertos. */
function scheduleFromHours(hours: HourRow[]): ScheduleRow[] {
  return hours.filter((h) => !h.is_closed).map((h) => ({ weekday: h.weekday, start_time: h.open_time, end_time: h.close_time }))
}

async function putServices(service: Service, orgId: string, list: NonNullable<CatalogInput['services']>) {
  const rows = list.map((s) => ({
    organization_id: orgId,
    partner_ref: s.externalId,
    name: s.name,
    description: s.description ?? null,
    duration_minutes: s.durationMinutes,
    price: s.price ?? null,
    price_text: s.priceText ?? null,
    active: s.active,
    sort_order: s.position,
  }))
  if (rows.length > 0) {
    const { error } = await service.from('service_catalogs').upsert(rows, { onConflict: 'organization_id,partner_ref' })
    if (error) throw new Error(error.message)
  }
  // Todo lo que no vino (incluidos los servicios sembrados o capturados a mano) queda inactivo.
  const keep = list.map((s) => s.externalId)
  // `not in` deja pasar los NULL (servicios propios): por eso el `or` con `is.null`.
  const quoted = keep.map((k) => `"${k.replace(/"/g, '')}"`).join(',')
  const { error } = await service
    .from('service_catalogs')
    .update({ active: false })
    .eq('organization_id', orgId)
    .eq('active', true)
    .or(keep.length > 0 ? `partner_ref.is.null,partner_ref.not.in.(${quoted})` : 'partner_ref.is.null,partner_ref.not.is.null')
  if (error) throw new Error(error.message)
  const { data } = await service.from('service_catalogs').select('id, partner_ref').eq('organization_id', orgId).in('partner_ref', keep.length ? keep : ['-'])
  const byRef = new Map((data ?? []).map((r) => [r.partner_ref, r.id]))
  return list.map((s) => ({ externalId: s.externalId, id: byRef.get(s.externalId) ?? null }))
}

async function putHours(service: Service, orgId: string, branchId: string, list: NonNullable<CatalogInput['hours']>) {
  const next: HourRow[] = list.map((h) => ({
    weekday: h.weekday,
    open_time: h.closed ? STARTER_HOURS.open : (h.opens as string),
    close_time: h.closed ? STARTER_HOURS.close : (h.closes as string),
    is_closed: h.closed,
  }))
  const { data: before } = await service.from('business_hours').select('weekday, open_time, close_time, is_closed').eq('branch_id', branchId)
  const { error: delErr } = await service.from('business_hours').delete().eq('branch_id', branchId)
  if (delErr) throw new Error(delErr.message)
  const { error } = await service.from('business_hours').insert(next.map((h) => ({ ...h, branch_id: branchId })))
  if (error) throw new Error(error.message)

  // Profesional único cuyo horario nadie personalizó (es el sembrado o el que
  // nosotros alineamos la vez anterior): se alinea al horario nuevo. Si el
  // dueño ya editó horarios de profesionales, no se tocan.
  const { data: resources } = await service.from('resources').select('id').eq('organization_id', orgId)
  if (resources?.length !== 1) return
  const rid = resources[0].id
  const { data: sched } = await service.from('staff_schedules').select('weekday, start_time, end_time').eq('resource_id', rid).eq('branch_id', branchId)
  const current = sched ?? []
  const untouched = sameSchedule(current, SEED_SCHEDULE) || sameSchedule(current, scheduleFromHours((before ?? []) as HourRow[]))
  if (!untouched) return
  await service.from('staff_schedules').delete().eq('resource_id', rid).eq('branch_id', branchId)
  const rows = scheduleFromHours(next).map((r) => ({ ...r, resource_id: rid, branch_id: branchId }))
  if (rows.length > 0) await service.from('staff_schedules').insert(rows)
}

/** PUT /organizations/{id}/catalog: reemplaza servicios y/o horario y marca la org como administrada por el socio. */
export async function putPartnerCatalog(service: Service, orgId: string, input: CatalogInput): Promise<NextResponse> {
  const { data: branch } = await service.from('branches').select('id').eq('organization_id', orgId).order('created_at').limit(1).maybeSingle()
  if (!branch) return apiError('not_found', 404, 'El negocio no tiene sucursal.')
  try {
    const services = input.services ? await putServices(service, orgId, input.services) : []
    if (input.hours) await putHours(service, orgId, branch.id, input.hours)
    const patch: { catalog_managed_by_partner: boolean; branding?: Json } = { catalog_managed_by_partner: true }
    if (input.brandColor) {
      // branding es jsonb con más llaves (logo, descripción): se conserva el resto.
      const { data: org } = await service.from('organizations').select('branding').eq('id', orgId).maybeSingle()
      const current = org?.branding && typeof org.branding === 'object' && !Array.isArray(org.branding) ? org.branding : {}
      patch.branding = { ...current, primary_color: input.brandColor.toLowerCase() }
    }
    await service.from('organizations').update(patch).eq('id', orgId)
    return NextResponse.json({ services, hoursUpdated: !!input.hours })
  } catch (err) {
    console.error('[socios] catálogo', err instanceof Error ? err.message : err)
    return apiError('update_failed', 500)
  }
}
