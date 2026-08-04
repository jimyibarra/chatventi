import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Destino del enlace de confirmación de correo. Soporta los dos formatos:
// - PKCE (?code=...): plantilla default de Supabase con emailRedirectTo.
// - token_hash (?token_hash=...&type=...): plantilla personalizada (con SMTP propio).
//
// El destino NO viaja en la URL a propósito: la plantilla de correo se
// construye en Supabase con token_hash, así que un ?next= obligaría a editar
// la plantilla y a depender de la lista de URLs permitidas. Se decide aquí,
// con el dato que manda: ¿esta cuenta ya tiene negocio?
//   sin perfil -> /bienvenida (asistente que crea la organización)
//   con perfil -> /dashboard
// En error manda a /login con aviso.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') as EmailOtpType | null) ?? 'signup'

  const supabase = await createClient()

  let verified = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    verified = !error
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    verified = !error
  }

  if (!verified) {
    return NextResponse.redirect(`${origin}/login?error=confirmacion`)
  }

  // Recuperación de contraseña: el destino es fijar la nueva contraseña.
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/nueva-clave`)
  }

  return NextResponse.redirect(`${origin}${await destinationForCurrentUser(supabase)}`)
}

/**
 * ¿Al asistente o al panel? Se decide por la existencia del perfil.
 *
 * `.eq('id', user.id)` NO es opcional: la policy de lectura deja ver los
 * perfiles de toda la organización, así que sin ese filtro esto devolvería N
 * filas en cuanto una cuenta tenga equipo (CLAUDE.md 2026-07-15). Ante
 * cualquier duda se manda a /dashboard, que ya tiene su propia red de
 * seguridad para cuentas sin negocio.
 */
async function destinationForCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/dashboard'

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return '/dashboard'
  return data ? '/dashboard' : '/bienvenida'
}
