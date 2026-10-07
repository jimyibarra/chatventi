import { after, NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/features/emails/mailer'
import { authEmail, type AuthEmailType } from '@/features/emails/auth-templates'
import { brandForOrg, brandForPartner, brandOrigin } from '@/features/marca/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Send Email Hook de Supabase Auth: desde que está encendido, TODOS los correos
// de Auth (confirmación, recuperación, enlace mágico, invitación, cambio de
// correo, código) salen de aquí. Los de un negocio de socio con marca llevan
// su logo, su remitente (Resend) y enlaces a su dominio; los demás, ChatVenti
// por el SMTP de siempre. Firma «Standard Webhooks» con el secreto del hook.

type Payload = {
  user: { id: string; email: string; new_email?: string | null; app_metadata?: Record<string, unknown> | null }
  email_data: {
    token?: string
    token_hash: string
    redirect_to?: string
    email_action_type: string
    token_new?: string
    token_hash_new?: string
  }
}

const TYPES = new Set<AuthEmailType>(['signup', 'recovery', 'magiclink', 'invite', 'email_change', 'reauthentication'])

/** Verifica `webhook-signature` (v1, HMAC-SHA256 en base64 de "id.timestamp.cuerpo") y que no tenga más de 5 minutos. */
function verify(request: NextRequest, body: string): boolean {
  const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim()
  const id = request.headers.get('webhook-id')
  const ts = request.headers.get('webhook-timestamp')
  const sigs = request.headers.get('webhook-signature')
  if (!secret || !id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const raw = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', raw).update(`${id}.${ts}.${body}`).digest()
  return sigs.split(' ').some((s) => {
    const [, sig] = s.split(',')
    if (!sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  if (!verify(request, body)) return NextResponse.json({ error: { http_code: 401, message: 'firma inválida' } }, { status: 401 })
  const payload = JSON.parse(body) as Payload
  const type = payload.email_data.email_action_type as AuthEmailType
  if (!TYPES.has(type)) return NextResponse.json({ error: { http_code: 400, message: `tipo no soportado: ${type}` } }, { status: 400 })

  // Marca: app_metadata.partner_id (lo escribe el alta por API; el usuario no lo
  // puede editar) y, de respaldo, la organización del perfil.
  const partnerId = typeof payload.user.app_metadata?.partner_id === 'string' ? payload.user.app_metadata.partner_id : null
  let brand = await brandForPartner(partnerId)
  if (!brand.partnerId) {
    const { data: profile } = await createServiceClient().from('profiles').select('organization_id').eq('id', payload.user.id).maybeSingle()
    if (profile?.organization_id) brand = await brandForOrg(profile.organization_id)
  }
  const origin = brand.partnerId ? brandOrigin(brand) : SITE
  const link = (hash: string) => `${origin}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${type}`

  const sends: { to: string; hash: string }[] = []
  if (type === 'reauthentication') sends.push({ to: payload.user.email, hash: '' })
  else if (type === 'email_change') {
    // Con confirmación doble llegan dos tokens: el del correo actual y el del nuevo.
    if (payload.email_data.token_hash) sends.push({ to: payload.user.email, hash: payload.email_data.token_hash })
    if (payload.email_data.token_hash_new && payload.user.new_email) sends.push({ to: payload.user.new_email, hash: payload.email_data.token_hash_new })
  } else sends.push({ to: payload.user.email, hash: payload.email_data.token_hash })

  // Supabase corta el hook a los 5 s y el SMTP de Hostinger en frío los rebasa
  // (probado en producción: hook_timeout). Se responde ya y el envío sigue
  // después de la respuesta; un fallo queda en los registros de Vercel.
  after(async () => {
    for (const s of sends) {
      const { subject, html } = authEmail({ type, brand, link: s.hash ? link(s.hash) : '', code: payload.email_data.token })
      const ok = await sendEmail({ to: s.to, subject, html, brand })
      if (!ok) console.error('[auth-email] no se pudo enviar', type, 'a', s.to, 'marca', brand.name)
    }
  })
  return NextResponse.json({})
}
