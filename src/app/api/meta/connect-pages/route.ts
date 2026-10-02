import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { planById } from '@/features/billing/plans'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// POST /api/meta/connect-pages
// El dueño conecta su página de Facebook (Messenger) y el Instagram enlazado
// a ella, sin intervención nuestra. Ruta AUTENTICADA.
//
// El navegador (Facebook Login para empresas) entrega un `code`. Aquí:
//   1. se canjea por un token;
//   2. se le pregunta A META qué páginas autorizó ese token (debug_token):
//      los ids de página NUNCA se toman del navegador;
//   3. por cada página: token de página, Instagram enlazado, suscripción de
//      nuestra app a sus mensajes;
//   4. se guardan los canales `messenger` e `instagram`.
//
// 🔴 El envío de Instagram cuelga del Page ID, no del id de Instagram: por eso
// el canal instagram guarda `page_id` en credentials (ver meta-messaging.ts).
// ---------------------------------------------------------------------

const GRAPH = 'https://graph.facebook.com/v25.0'
const MAX_PAGES = 5

const bodySchema = z.object({ code: z.string().min(1) })

type Connected = { type: 'messenger' | 'instagram'; name: string; status: string }

async function graph<T>(path: string, token: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      console.error('[connect-pages]', path.split('?')[0], res.status, (await res.text()).slice(0, 200))
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error('[connect-pages]', path.split('?')[0], String(err).slice(0, 200))
    return null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Solo dueño o gerente de una organización.
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const orgId = profile.organization_id as string

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return NextResponse.json({ error: 'not_configured' }, { status: 500 })

  const service = createServiceClient()

  // 2. El plan debe incluir Instagram y Messenger. Durante la prueba gratis
  //    (sin suscripción) se permite: es la forma de conocer el producto entero.
  const { data: sub } = await service
    .from('subscriptions')
    .select('status, plan_id')
    .eq('organization_id', orgId)
    .maybeSingle()
  const paying = sub && ['active', 'trialing'].includes(sub.status)
  if (paying && !planById(sub.plan_id).aiChannels.includes('Instagram')) {
    return NextResponse.json({ error: 'plan_required' }, { status: 402 })
  }

  // 3. code → token, y de ser posible uno de larga duración (así los tokens de
  //    página que salen de él no caducan).
  const exchange = new URL(`${GRAPH}/oauth/access_token`)
  exchange.searchParams.set('client_id', appId)
  exchange.searchParams.set('client_secret', appSecret)
  exchange.searchParams.set('code', parsed.data.code)
  const first = await fetch(exchange).then((r) => r.json().catch(() => null)).catch(() => null)
  let userToken = (first as { access_token?: string } | null)?.access_token
  if (!userToken) {
    console.error('[connect-pages] token exchange', JSON.stringify(first).slice(0, 200))
    return NextResponse.json({ error: 'token_exchange_failed' }, { status: 502 })
  }
  const longUrl = new URL(`${GRAPH}/oauth/access_token`)
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', appId)
  longUrl.searchParams.set('client_secret', appSecret)
  longUrl.searchParams.set('fb_exchange_token', userToken)
  const long = await fetch(longUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  userToken = (long as { access_token?: string } | null)?.access_token ?? userToken

  // 4. ¿Qué páginas autorizó? Se lo decimos a Meta con el token de la APP. El
  //    inicio de sesión para empresas no lista las páginas en /me/accounts,
  //    pero sí las declara en granular_scopes.
  const debugUrl = new URL(`${GRAPH}/debug_token`)
  debugUrl.searchParams.set('input_token', userToken)
  debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)
  const debug = (await fetch(debugUrl).then((r) => r.json().catch(() => null)).catch(() => null)) as {
    data?: { is_valid?: boolean; app_id?: string; granular_scopes?: { scope: string; target_ids?: string[] }[] }
  } | null
  if (!debug?.data?.is_valid || debug.data.app_id !== appId) {
    return NextResponse.json({ error: 'token_invalid' }, { status: 502 })
  }
  const pageScopes = new Set(['pages_messaging', 'pages_show_list', 'pages_manage_metadata', 'pages_read_engagement'])
  const pageIds = new Set<string>()
  for (const g of debug.data.granular_scopes ?? []) {
    if (pageScopes.has(g.scope)) for (const id of g.target_ids ?? []) pageIds.add(id)
  }
  if (pageIds.size === 0) {
    const accounts = await graph<{ data?: { id: string }[] }>('me/accounts?fields=id&limit=25', userToken)
    for (const a of accounts?.data ?? []) pageIds.add(a.id)
  }
  if (pageIds.size === 0) return NextResponse.json({ error: 'no_pages' }, { status: 422 })

  // 5. Cada página: token propio, Instagram enlazado, suscripción y canales.
  const connected: Connected[] = []
  const skipped: string[] = []
  for (const pageId of [...pageIds].slice(0, MAX_PAGES)) {
    const page = await graph<{
      id: string
      name?: string
      access_token?: string
      instagram_business_account?: { id: string; username?: string }
    }>(`${pageId}?fields=id,name,access_token,instagram_business_account{id,username}`, userToken)
    if (!page?.access_token) {
      skipped.push('no_page_token')
      continue
    }

    const subscribed = await graph<{ success?: boolean }>(
      `${page.id}/subscribed_apps?subscribed_fields=messages`,
      page.access_token,
      { method: 'POST' }
    )
    const status = subscribed?.success ? 'active' : 'pending'
    const obtained = new Date().toISOString()

    const targets: { type: 'messenger' | 'instagram'; externalId: string; name: string; credentials: Record<string, string> }[] = [
      {
        type: 'messenger',
        externalId: page.id,
        name: page.name ?? 'Página de Facebook',
        credentials: { access_token: page.access_token, source: 'self_serve', obtained_at: obtained },
      },
    ]
    if (page.instagram_business_account?.id) {
      targets.push({
        type: 'instagram',
        externalId: page.instagram_business_account.id,
        name: page.instagram_business_account.username ? `@${page.instagram_business_account.username}` : 'Instagram',
        credentials: { access_token: page.access_token, page_id: page.id, source: 'self_serve', obtained_at: obtained },
      })
    }

    for (const t of targets) {
      // Un canal conectado en OTRA organización no se reasigna. (type,
      // external_id) es único: maybeSingle() ve como mucho una fila.
      const { data: existing, error: lookupErr } = await service
        .from('channels')
        .select('organization_id')
        .eq('type', t.type)
        .eq('external_id', t.externalId)
        .maybeSingle()
      if (lookupErr) return NextResponse.json({ error: 'channel_lookup_failed' }, { status: 500 })
      if (existing && existing.organization_id !== orgId) {
        skipped.push('in_use')
        continue
      }
      const { error } = await service.from('channels').upsert(
        {
          organization_id: orgId,
          type: t.type,
          external_id: t.externalId,
          display_name: t.name,
          credentials: t.credentials,
          status,
        },
        { onConflict: 'type,external_id' }
      )
      if (error) {
        console.error('[connect-pages] upsert', t.type, error.message)
        skipped.push('persist_failed')
        continue
      }
      connected.push({ type: t.type, name: t.name, status })
    }
  }

  if (connected.length === 0) {
    const reason = skipped.includes('in_use') ? 'page_in_use' : 'no_page_token'
    return NextResponse.json({ error: reason }, { status: 409 })
  }
  return NextResponse.json({ ok: true, connected })
}
