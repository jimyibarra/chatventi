'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { publishTemplates, type PublishSummary } from './service'

export type PublishResult = { ok: true; summary: PublishSummary } | { ok: false; error: string }

async function myRole(): Promise<{ role: string | null; orgId: string | null }> {
  const supabase = await createClient()
  const [{ data: role }, { data: orgId }] = await Promise.all([supabase.rpc('get_my_role'), supabase.rpc('get_my_org')])
  return { role: (role as string | null) ?? null, orgId: (orgId as string | null) ?? null }
}

/** Super admin: pide las plantillas que falten en todos los WhatsApp, o en uno. */
export async function publishTemplatesAdmin(channelId?: unknown): Promise<PublishResult> {
  const parsed = z.string().uuid().optional().safeParse(channelId)
  if (!parsed.success) return { ok: false, error: 'Canal inválido.' }
  if ((await myRole()).role !== 'super_admin') return { ok: false, error: 'No autorizado.' }
  try {
    const summary = await publishTemplates({ channelId: parsed.data })
    revalidatePath('/admin/plantillas')
    return { ok: true, summary }
  } catch {
    return { ok: false, error: 'No se pudo hablar con Meta. Intenta de nuevo.' }
  }
}

/** Dueño: pide las plantillas que falten en el WhatsApp de su negocio. */
export async function publishMyTemplates(): Promise<PublishResult> {
  const { role, orgId } = await myRole()
  if (!orgId || role !== 'owner') return { ok: false, error: 'Solo el dueño del negocio puede hacerlo.' }
  try {
    const summary = await publishTemplates({ orgId })
    revalidatePath('/dashboard/conexiones')
    return { ok: true, summary }
  } catch {
    return { ok: false, error: 'No se pudo hablar con Meta. Intenta de nuevo.' }
  }
}
