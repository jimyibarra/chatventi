import { NextResponse } from 'next/server'
import type { Json } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { managementTokens } from '@/features/agente-ia/wa-templates'
import { metaAppForOrg } from '@/features/marca/meta-app'
import { historyWindowOpen } from '@/features/coexistencia/parse'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// Historial opcional de un número en coexistencia (decisión de Juan, 16-oct):
// NO se importa por defecto; el dueño lo pide con un botón. Meta solo lo
// permite en las primeras 24 h tras conectar y manda hasta 180 días; aquí se
// guardan los últimos 90 (ver parseHistory). También pide los contactos.
//   POST   → pide historial y contactos a Meta
//   DELETE → borra lo importado (mensajes con origin = 'history')
// ---------------------------------------------------------------------

const GRAPH = 'https://graph.facebook.com/v25.0'

async function ownerOrg() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id || !['owner', 'manager'].includes(profile.role)) return null
  return profile.organization_id as string
}

async function coexChannel(orgId: string) {
  const { data } = await createServiceClient()
    .from('channels')
    .select('id, external_id, credentials')
    .eq('organization_id', orgId)
    .eq('type', 'whatsapp')
    .eq('status', 'active')
    .eq('credentials->>mode', 'coexistence')
    .limit(1)
    .maybeSingle()
  return data
}

export async function POST(): Promise<NextResponse> {
  const orgId = await ownerOrg()
  if (!orgId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const ch = await coexChannel(orgId)
  if (!ch) return NextResponse.json({ error: 'no_coexistence_channel' }, { status: 404 })
  const creds = (ch.credentials ?? {}) as Record<string, unknown>
  if (!historyWindowOpen(creds.obtained_at as string | undefined)) {
    return NextResponse.json({ error: 'window_closed' }, { status: 409 })
  }
  if (creds.history_requested_at) return NextResponse.json({ ok: true, already: true })

  const meta = await metaAppForOrg(orgId)
  const results: Record<string, string> = {}
  for (const syncType of ['smb_app_state_sync', 'history'] as const) {
    let outcome = 'sin_token'
    for (const token of managementTokens(creds.access_token as string | undefined, meta?.systemUserToken)) {
      const res = await fetch(`${GRAPH}/${encodeURIComponent(ch.external_id)}/smb_app_data`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null)
      if (res?.ok) {
        outcome = 'ok'
        break
      }
      outcome = res ? `HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` : 'red'
    }
    results[syncType] = outcome
  }
  const ok = results.history === 'ok'
  await createServiceClient()
    .from('channels')
    .update({ credentials: { ...creds, history_requested_at: new Date().toISOString(), history_state: ok ? 'requested' : 'failed', history_request_result: results } as Json })
    .eq('id', ch.id)
  if (!ok) console.error('[coexistencia] historial', JSON.stringify(results))
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 })
}

export async function DELETE(): Promise<NextResponse> {
  const orgId = await ownerOrg()
  if (!orgId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const service = createServiceClient()
  const { error, count } = await service.from('messages').delete({ count: 'exact' }).eq('organization_id', orgId).eq('origin', 'history')
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  const ch = await coexChannel(orgId)
  if (ch) {
    const creds = (ch.credentials ?? {}) as Record<string, unknown>
    await service.from('channels').update({ credentials: { ...creds, history_state: 'deleted', history_deleted_at: new Date().toISOString() } as Json }).eq('id', ch.id)
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
