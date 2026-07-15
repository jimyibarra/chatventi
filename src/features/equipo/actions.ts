'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isBillingEnforced } from '@/features/billing/gating'
import { sendEmail } from '@/features/emails/mailer'
import { teamInvitationEmail } from '@/features/emails/templates'
import { inviteSchema, changeRoleSchema, TEAM_ROLES } from './types'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const PATH = '/dashboard/equipo'

function humanizeError(message: string): string {
  if (message.includes('no_seats'))
    return 'No te quedan accesos disponibles. Añade asientos desde Facturación.'
  if (message.includes('already_member')) return 'Esa persona ya forma parte de tu equipo.'
  if (message.includes('invalid_email')) return 'Correo inválido.'
  if (message.includes('cannot_change_own_role')) return 'No puedes cambiar tu propio rol.'
  if (message.includes('cannot_deactivate_self')) return 'No puedes desactivarte a ti mismo.'
  if (message.includes('member_not_found')) return 'Ese miembro ya no existe.'
  if (message.includes('resource_not_found')) return 'Ese profesional ya no existe.'
  if (message.includes('forbidden')) return 'Solo el dueño puede gestionar el equipo.'
  if (message.includes('no_organization')) return 'No tienes una organización.'
  return 'Ocurrió un error. Intenta de nuevo.'
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')
}

// El correo puede fallar (SMTP sin configurar devuelve false SIN romper): en
// ese caso se devuelve el enlace para que el dueño lo copie y lo mande él.
// Una invitación que "se envió" pero nunca llegó es peor que una sin correo.
type InviteData = { email: string; link: string; emailSent: boolean }

async function sendInvite(params: {
  token: string
  email: string
  roleLabel: string
}): Promise<InviteData> {
  const supabase = await createClient()
  const link = `${siteUrl()}/invitacion/${params.token}`

  const [{ data: org }, { data: me }] = await Promise.all([
    supabase.from('organizations').select('name').maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle(),
  ])

  const built = teamInvitationEmail({
    orgName: org?.name ?? 'tu negocio',
    roleLabel: params.roleLabel,
    inviterName: me?.full_name ?? null,
    acceptUrl: link,
  })
  const emailSent = await sendEmail({ to: params.email, subject: built.subject, html: built.html })
  return { email: params.email, link, emailSent }
}

// -------------------------------------------------------------------
// Invitar (y reinvitar: la RPC renueva token y caducidad)
// -------------------------------------------------------------------
export async function inviteMember(raw: unknown): Promise<ActionResult<InviteData>> {
  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { email, roleKey, resourceId } = parsed.data
  const meta = TEAM_ROLES[roleKey]
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_team_invitation', {
    p_email: email,
    p_role: meta.role,
    p_scope: meta.scope,
    p_resource_id: resourceId ?? undefined,
    // La bandera vive en Node, no en Postgres: se pasa para que el límite se
    // compruebe dentro de la misma transacción que inserta.
    p_enforce_seats: isBillingEnforced(),
  })
  if (error) return { ok: false, error: humanizeError(error.message) }

  const invitation = data as unknown as { token: string; email: string }
  const sent = await sendInvite({
    token: invitation.token,
    email: invitation.email,
    roleLabel: meta.label,
  })
  revalidatePath(PATH)
  return { ok: true, data: sent }
}

export async function resendInvitation(email: string, roleKeyRaw: string): Promise<ActionResult<InviteData>> {
  return inviteMember({ email, roleKey: roleKeyRaw })
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_team_invitation', { p_id: id })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(PATH)
  return { ok: true }
}

// -------------------------------------------------------------------
// Rol y estado de un miembro (vía RPC: no hay policy para editar a otros)
// -------------------------------------------------------------------
export async function changeMemberRole(raw: unknown): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { profileId, roleKey, resourceId } = parsed.data
  const meta = TEAM_ROLES[roleKey]
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_member_role', {
    p_profile_id: profileId,
    p_role: meta.role,
    p_scope: meta.scope,
    p_resource_id: resourceId ?? undefined,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(PATH)
  return { ok: true }
}

export async function setMemberActive(profileId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_member_active', {
    p_profile_id: profileId,
    p_active: active,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath(PATH)
  return { ok: true }
}
