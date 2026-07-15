'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { acceptInvitationSchema } from './types'

export type AcceptResult = { ok: true } | { ok: false; error: string }

/**
 * Alta del invitado: crea su cuenta, lo autentica y lo mete en la org.
 *
 * Se crea el usuario con el SERVICE client y `email_confirm: true` a propósito:
 * el invitado llegó aquí desde un enlace enviado A SU CORREO, así que la
 * titularidad del email ya está probada. Mandarle además el correo de
 * confirmación de Supabase sería un segundo salto innecesario que dispara
 * abandono, y `signUp` normal no permite marcarlo como confirmado.
 *
 * Es un camino DISTINTO al de create_organization_with_owner: aquí NO se crea
 * organización, solo el profile dentro de la que invita.
 */
export async function acceptInvitation(raw: unknown): Promise<AcceptResult> {
  const parsed = acceptInvitationSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { token, fullName, password } = parsed.data

  const supabase = await createClient()

  // 1. Validar la invitación ANTES de crear ninguna cuenta.
  const { data: preview, error: previewError } = await supabase.rpc('get_invitation_preview', {
    p_token: token,
  })
  if (previewError) return { ok: false, error: 'No se pudo validar la invitación.' }

  const inv = preview as unknown as {
    valid: boolean
    reason?: string
    email?: string
    has_account?: boolean
  } | null

  if (!inv?.valid) {
    return { ok: false, error: reasonToMessage(inv?.reason) }
  }
  const email = inv.email as string

  // 2. Crear la cuenta (o pedirle que inicie sesión si ya la tenía).
  if (inv.has_account) {
    return {
      ok: false,
      error:
        'Ya tienes una cuenta con este correo. Inicia sesión y vuelve a abrir el enlace de la invitación.',
    }
  }

  let admin
  try {
    admin = createServiceClient()
  } catch {
    return { ok: false, error: 'Configuración incompleta del servidor. Avisa al negocio.' }
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError) {
    return { ok: false, error: 'No se pudo crear tu cuenta. Intenta de nuevo.' }
  }

  // 3. Autenticar (deja las cookies de sesión) para que auth.uid() exista.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    return { ok: false, error: 'Tu cuenta se creó, pero no pudimos iniciar sesión. Prueba en /login.' }
  }

  // 4. Crear el profile dentro de la org. La RPC vuelve a validar el token y
  //    que el email autenticado sea el invitado: no basta con tener el enlace.
  const { error: acceptError } = await supabase.rpc('accept_team_invitation', { p_token: token })
  if (acceptError) {
    return { ok: false, error: reasonToMessage(acceptError.message) }
  }

  return { ok: true }
}

function reasonToMessage(reason: string | undefined): string {
  if (!reason) return 'Esta invitación no es válida.'
  if (reason.includes('expired')) return 'Esta invitación caducó. Pídele al negocio que te reenvíe una.'
  if (reason.includes('revoked')) return 'Esta invitación fue cancelada.'
  if (reason.includes('accepted')) return 'Esta invitación ya se usó. Inicia sesión con tu cuenta.'
  if (reason.includes('already_member')) return 'Ya formas parte de un negocio en ChatVenti.'
  if (reason.includes('email_mismatch')) return 'Esta invitación es para otro correo.'
  if (reason.includes('not_found')) return 'Esta invitación no existe.'
  return 'Esta invitación no es válida.'
}
