import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/service'
import { managementTokens } from '@/features/agente-ia/wa-templates'
import { metaAppForOrg } from '@/features/marca/meta-app'
import { enqueuePartnerChannelEvent } from '@/features/coexistencia/service'
import { managerOrgId } from '@/features/conexiones/session'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// Desconectar un WhatsApp desde Conexiones (16-oct-2026, pedido de Juan).
//
//   · La recepcionista deja de usar el número: canal 'disabled', sin token.
//   · Se quita la suscripción de la app ChatVenti a la cuenta de WhatsApp
//     (WABA) para que Meta deje de mandarnos sus mensajes, salvo que otro
//     número activo de esa misma cuenta siga conectado.
//   · NO se da de baja el número en Meta (deregister): reconectar debe ser
//     un clic. Para soltarlo del todo, el dueño lo hace en su app (coexistencia)
//     o en WhatsApp Manager (número completo); la pantalla le dice cómo.
//   · El PIN se conserva: Meta lo pide para volver a registrar el número.
//   · Al socio del negocio le llega channel.disconnected (owner_disconnected).
// ---------------------------------------------------------------------

const GRAPH = 'https://graph.facebook.com/v25.0'
const bodySchema = z.object({ channelId: z.string().uuid() })

async function unsubscribeApp(wabaId: string, tokens: string[]): Promise<string> {
  let outcome = 'sin_token'
  for (const token of tokens) {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    if (res?.ok) return 'ok'
    outcome = res ? `HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` : 'red'
  }
  return outcome
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = await managerOrgId()
  if (!orgId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  // service_role acotado a la organización de la sesión (credentials no se lee con la sesión).
  const service = createServiceClient()
  const { data: ch } = await service
    .from('channels')
    .select('id, waba_id, display_name, status, credentials')
    .eq('id', parsed.data.channelId)
    .eq('organization_id', orgId)
    .eq('type', 'whatsapp')
    .maybeSingle()
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (ch.status === 'disabled') return NextResponse.json({ ok: true, already: true })

  const creds = { ...((ch.credentials ?? {}) as Record<string, unknown>) }
  const mode = creds.mode === 'coexistence' ? 'coexistence' : 'cloud_api'

  let unsubscribe = 'otro_numero_activo'
  if (ch.waba_id) {
    const { count } = await service
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'whatsapp')
      .eq('waba_id', ch.waba_id)
      .neq('id', ch.id)
      .neq('status', 'disabled')
    if ((count ?? 0) === 0) {
      const meta = await metaAppForOrg(orgId)
      unsubscribe = await unsubscribeApp(ch.waba_id, managementTokens(creds.access_token as string | undefined, meta?.systemUserToken))
      if (unsubscribe !== 'ok') console.error('[whatsapp-disconnect] subscribed_apps', unsubscribe)
    }
  }

  delete creds.access_token
  delete creds.previous
  const now = new Date().toISOString()
  const { error } = await service
    .from('channels')
    .update({
      status: 'disabled',
      disconnected_at: now,
      disconnect_reason: 'owner',
      credentials: { ...creds, owner_disconnected_at: now, unsubscribe_result: unsubscribe } as Json,
    })
    .eq('id', ch.id)
  if (error) {
    console.error('[whatsapp-disconnect] update', error.message)
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 })
  }

  await enqueuePartnerChannelEvent(service, orgId, 'channel.disconnected', {
    type: 'whatsapp',
    mode,
    number: ch.display_name,
    level: null,
    daysIdle: null,
    reason: 'owner_disconnected',
  }).catch(() => null)

  return NextResponse.json({ ok: true, mode })
}
