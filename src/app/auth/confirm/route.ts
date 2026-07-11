import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Destino del enlace de confirmación de correo. Soporta los dos formatos:
// - PKCE (?code=...): plantilla default de Supabase con emailRedirectTo.
// - token_hash (?token_hash=...&type=...): plantilla personalizada (con SMTP propio).
// En éxito deja la sesión iniciada y manda a /dashboard (ahí se crea el
// negocio pendiente del signup). En error manda a /login con aviso.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') as EmailOtpType | null) ?? 'signup'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}/login?error=confirmacion`)
}
