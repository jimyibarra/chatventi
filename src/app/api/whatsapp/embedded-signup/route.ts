import { randomInt } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------
// POST /api/whatsapp/embedded-signup
// Flujo Tech Provider (Embedded Signup). Ruta AUTENTICADA: la ejecuta el
// dueño del negocio desde el dashboard. NO es el webhook ANON.
//
// El frontend (Facebook JS SDK, FB.login con el Embedded Signup) devuelve:
//   - `code`            -> se intercambia por un token de negocio (Graph API)
//   - `phone_number_id` -> external_id del canal WhatsApp
//   - `waba_id`         -> WhatsApp Business Account compartida con nuestro Tech Provider
// Guardamos un `channel` (type='whatsapp') activo para la organizacion.
// ---------------------------------------------------------------------
const bodySchema = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  displayName: z.string().optional(),
})

const GRAPH_VERSION = 'v21.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

/**
 * Suscribe NUESTRA app a los webhooks de la WABA del cliente. Sin esto, los
 * mensajes entrantes del número del cliente nunca llegan a nuestro webhook.
 * POST /{waba_id}/subscribed_apps  (con el token del negocio o del System User).
 */
async function subscribeAppToWaba(wabaId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) return `subscribe ${res.status}: ${await res.text().catch(() => '')}`.slice(0, 300)
    return null
  } catch (err) {
    return `subscribe_error: ${String(err)}`.slice(0, 300)
  }
}

/**
 * Registra (activa) el número en la Cloud API con un PIN de verificación en dos
 * pasos. POST /{phone_number_id}/register. Idempotente: si el número ya estaba
 * registrado Meta responde error benigno -> lo tratamos como no-fatal.
 */
async function registerPhoneNumber(
  phoneNumberId: string,
  token: string,
  pin: string
): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    })
    if (!res.ok) return `register ${res.status}: ${await res.text().catch(() => '')}`.slice(0, 300)
    return null
  } catch (err) {
    return `register_error: ${String(err)}`.slice(0, 300)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Autenticacion: solo un usuario con org (owner/manager) puede conectar.
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id || !['owner', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 2. Validar el body del Embedded Signup.
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'invalid_body', detail: String(err) }, { status: 400 })
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'faltan NEXT_PUBLIC_META_APP_ID o META_APP_SECRET' },
      { status: 500 }
    )
  }

  // 3. Intercambiar el `code` por un access_token de negocio (Graph API).
  const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', appId)
  tokenUrl.searchParams.set('client_secret', appSecret)
  tokenUrl.searchParams.set('code', body.code)

  let accessToken: string
  try {
    const res = await fetch(tokenUrl, { method: 'GET' })
    const json: unknown = await res.json()
    if (!res.ok) {
      console.error('[embedded-signup] token exchange fallo', json)
      return NextResponse.json({ error: 'token_exchange_failed', detail: json }, { status: 502 })
    }
    accessToken = tokenResponseSchema.parse(json).access_token
  } catch (err) {
    console.error('[embedded-signup] error intercambiando code', err)
    return NextResponse.json({ error: 'token_exchange_error' }, { status: 502 })
  }

  // 4. Token de gestión para llamar a la Graph API en nombre del cliente.
  //    Preferimos el token del System User de nuestro Tech Provider (permanente,
  //    ámbito acotado a nuestros assets); si no existe, usamos el token del
  //    negocio recién intercambiado (válido para su propia WABA).
  const mgmtToken = process.env.META_SYSTEM_USER_TOKEN?.trim() || accessToken

  // 5. Suscribir nuestra app a la WABA del cliente (webhooks entrantes) y
  //    registrar el número. No-fatales: si fallan, guardamos el canal como
  //    'pending' con la nota del error para reintentar, en vez de perder la conexión.
  const pin = String(randomInt(100000, 1000000)) // PIN de 2FA (6 dígitos).
  const subscribeErr = await subscribeAppToWaba(body.wabaId, mgmtToken)
  if (subscribeErr) console.error('[embedded-signup]', subscribeErr)
  const registerErr = await registerPhoneNumber(body.phoneNumberId, mgmtToken, pin)
  if (registerErr) console.error('[embedded-signup]', registerErr)

  // 6. Registrar/activar el canal (service_role: manejamos secretos server-side,
  //    fuera del alcance de RLS de lectura del negocio).
  const service = createServiceClient()
  const credentials = {
    access_token: accessToken,
    pin,
    obtained_at: new Date().toISOString(),
    subscribe_error: subscribeErr,
    register_error: registerErr,
  }
  const status = subscribeErr ? 'pending' : 'active'

  const { data: channel, error } = await service
    .from('channels')
    .upsert(
      {
        organization_id: profile.organization_id,
        type: 'whatsapp',
        external_id: body.phoneNumberId,
        waba_id: body.wabaId,
        display_name: body.displayName ?? null,
        credentials,
        status,
      },
      { onConflict: 'type,external_id' }
    )
    .select('id, status')
    .single()

  if (error) {
    console.error('[embedded-signup] upsert channel error', error.message)
    return NextResponse.json({ error: 'channel_persist_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    channelId: channel.id,
    status: channel.status,
    warnings: [subscribeErr, registerErr].filter(Boolean),
  })
}
