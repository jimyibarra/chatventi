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

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

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

  // TODO(config_id): el flujo self-service moderno usa un `configuration_id`
  //   (META_CONFIG_ID) en el FB.login del frontend; aqui no se consume, pero se
  //   documenta como dependencia de credenciales pendiente.
  // TODO(system-user-token): para llamar a la Graph API en nombre del cliente
  //   (suscribir la WABA a nuestra app, registrar el numero, enviar plantillas),
  //   se necesita el token del System User de nuestro Tech Provider
  //   (META_SYSTEM_USER_TOKEN). Con el, hay que:
  //     - POST /{waba_id}/subscribed_apps           (suscribir la app al webhook)
  //     - POST /{phone_number_id}/register          (activar el numero, con PIN)
  //   Esos pasos se completan cuando existan las credenciales.

  // 4. Registrar/activar el canal (service_role: manejamos secretos server-side,
  //    fuera del alcance de RLS de lectura del negocio).
  const service = createServiceClient()
  const credentials = {
    access_token: accessToken, // TODO: rotar por token de System User cuando exista.
    obtained_at: new Date().toISOString(),
  }

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
        status: 'active',
      },
      { onConflict: 'type,external_id' }
    )
    .select('id, status')
    .single()

  if (error) {
    console.error('[embedded-signup] upsert channel error', error.message)
    return NextResponse.json({ error: 'channel_persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, channelId: channel.id, status: channel.status })
}
