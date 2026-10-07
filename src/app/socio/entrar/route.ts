import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LOGIN_NEXT, redeemLoginTicket } from '@/features/socios/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Canje del pase de entrada de un socio (POST /partners/v1/.../login-link).
// El ticket solo sirve una vez y 60 s; aquí se cambia por una sesión DEL
// DUEÑO creada del lado del servidor: el token de Supabase nunca viaja en
// una URL. Si el navegador traía la sesión de otra persona, se cierra antes.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const ticket = searchParams.get('t') ?? ''
  const next = searchParams.get('next') ?? '/dashboard'
  const dest = (LOGIN_NEXT as readonly string[]).includes(next) ? next : '/dashboard'
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

  const owner = await redeemLoginTicket(ticket)
  if (!owner) return NextResponse.redirect(`${origin}/login?error=pase`, { headers })

  const supabase = await createClient()
  const {
    data: { user: current },
  } = await supabase.auth.getUser()
  if (current && current.id !== owner.userId) await supabase.auth.signOut({ scope: 'local' })

  const { data: link, error: linkErr } = await createServiceClient().auth.admin.generateLink({ type: 'magiclink', email: owner.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) return NextResponse.redirect(`${origin}/login?error=pase`, { headers })
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (error) return NextResponse.redirect(`${origin}/login?error=pase`, { headers })

  return NextResponse.redirect(`${origin}${dest}`, { headers })
}
