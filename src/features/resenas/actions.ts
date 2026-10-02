'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { placeHours, reviewUrlFor, searchPlaces, type PlaceHit } from './places'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const PATH = '/dashboard/agente'

/** La organización del usuario, solo si es dueño o gerente. */
async function myOrg() {
  const supabase = await createClient()
  const [{ data: orgId }, { data: role }] = await Promise.all([
    supabase.rpc('get_my_org'),
    supabase.rpc('get_my_role'),
  ])
  if (!orgId || (role !== 'owner' && role !== 'manager')) return null
  return { supabase, orgId: orgId as string, isOwner: role === 'owner' }
}

/** Busca la ficha del negocio en Google. Cada búsqueda cuesta: tope por negocio. */
export async function searchMyBusiness(raw: unknown): Promise<Result<PlaceHit[]>> {
  const parsed = z.string().trim().min(3).max(120).safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Escribe el nombre de tu negocio y tu ciudad.' }
  const ctx = await myOrg()
  if (!ctx) return { ok: false, error: 'Solo el dueño o un gerente pueden hacer esto.' }

  const allowed = await consumeRateLimit({
    bucket: 'places_org',
    key: ctx.orgId,
    limit: 15,
    windowSeconds: 24 * 60 * 60,
  })
  if (!allowed) return { ok: false, error: 'Llegaste al límite de búsquedas por hoy. Pega tu enlace a mano.' }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('country')
    .eq('id', ctx.orgId)
    .maybeSingle()
  const hits = await searchPlaces(parsed.data, org?.country)
  if (hits.length === 0) return { ok: false, error: 'No lo encontramos. Prueba con nombre y ciudad, o pega tu enlace a mano.' }
  return { ok: true, data: hits }
}

const saveSchema = z.object({
  placeId: z.string().trim().min(5).max(300).optional(),
  url: z.string().trim().max(500).optional(),
})

/** Guarda (o borra, con todo vacío) el enlace para dejar reseña. */
export async function saveReviewLink(raw: unknown): Promise<Result> {
  const parsed = saveSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }
  const ctx = await myOrg()
  if (!ctx?.isOwner) return { ok: false, error: 'Solo el dueño puede cambiar esto.' }

  const { placeId, url } = parsed.data
  let reviewUrl: string | null = null
  if (placeId) reviewUrl = reviewUrlFor(placeId)
  else if (url) {
    if (!/^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.page)\//i.test(url)) {
      return { ok: false, error: 'Pega el enlace de reseñas de Google (empieza por https://g.page, goo.gl o google.com).' }
    }
    reviewUrl = url
  }

  const { data, error } = await ctx.supabase
    .from('organizations')
    .update({ google_review_url: reviewUrl, google_place_id: placeId ?? null })
    .eq('id', ctx.orgId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'No se pudo guardar el enlace.' }
  revalidatePath(PATH)
  return { ok: true }
}

/** Copia a la agenda el horario que el negocio tiene publicado en Google. */
export async function importHoursFromGoogle(): Promise<Result<number>> {
  const ctx = await myOrg()
  if (!ctx) return { ok: false, error: 'Solo el dueño o un gerente pueden hacer esto.' }

  const [{ data: org }, { data: branch }] = await Promise.all([
    ctx.supabase.from('organizations').select('google_place_id').eq('id', ctx.orgId).maybeSingle(),
    ctx.supabase.from('branches').select('id').order('created_at').limit(1).maybeSingle(),
  ])
  if (!org?.google_place_id) return { ok: false, error: 'Primero elige tu negocio en Google.' }
  if (!branch) return { ok: false, error: 'No encontramos tu sucursal.' }

  const hours = await placeHours(org.google_place_id)
  if (!hours?.length) return { ok: false, error: 'Tu ficha de Google no tiene horario publicado.' }

  // Los 7 días: los que Google no lista quedan como cerrados.
  const open = new Map(hours.map((h) => [h.weekday, h]))
  const rows = Array.from({ length: 7 }, (_, weekday) => {
    const h = open.get(weekday)
    return {
      branch_id: branch.id,
      weekday,
      open_time: h?.open ?? '09:00',
      close_time: h?.close ?? '18:00',
      is_closed: !h,
    }
  })
  const { error: delErr } = await ctx.supabase.from('business_hours').delete().eq('branch_id', branch.id)
  if (delErr) return { ok: false, error: 'No se pudo actualizar el horario.' }
  const { error } = await ctx.supabase.from('business_hours').insert(rows)
  if (error) return { ok: false, error: 'No se pudo guardar el horario.' }

  revalidatePath('/dashboard/agenda/configuracion')
  return { ok: true, data: hours.length }
}
