import { createClient } from '@/lib/supabase/server'
import { AcceptInvitationForm } from '@/features/equipo/components/accept-invitation-form'
import { TEAM_ROLES, roleKeyOf } from '@/features/equipo/types'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { AuthCard } from '@/features/auth/components/auth-card'
import { ButtonLink } from '@/shared/components/ui/button'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Invitación' }

type Preview = {
  valid: boolean
  reason?: string
  org_name?: string
  email?: string
  role?: string
  has_account?: boolean
}

// Pantalla pública (patrón de /c/[token]): el invitado aún no tiene cuenta.
// El token es el secreto; la RPC solo expone org, email y rol. Usa el armazón
// de acceso: es, en la práctica, un registro.
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_invitation_preview', { p_token: token })
  const preview = data as unknown as Preview | null

  const orgName = preview?.org_name ?? 'un negocio'

  if (!preview?.valid) {
    return (
      <AuthShell>
        <AuthCard title="Esta invitación no está disponible" subtitle={reasonMessage(preview?.reason)}>
          <ButtonLink href="/login" variant="secondary" className="w-full">
            Ir a iniciar sesión
          </ButtonLink>
        </AuthCard>
      </AuthShell>
    )
  }

  const roleLabel = TEAM_ROLES[roleKeyOf(preview.role ?? 'staff', null)].label

  // Ya tiene cuenta: no podemos crearle otra. Que entre y vuelva al enlace.
  if (preview.has_account) {
    return (
      <AuthShell>
        <AuthCard
          title={`Te invitaron a ${orgName}`}
          subtitle={
            <>
              Ya tienes una cuenta de ChatVenti con <strong className="font-semibold text-ink">{preview.email}</strong>.
              Inicia sesión y vuelve a abrir este enlace para unirte al equipo.
            </>
          }
        >
          <ButtonLink href="/login" className="w-full">
            Iniciar sesión
          </ButtonLink>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthCard
        title={`Te invitaron a ${orgName}`}
        subtitle={
          <>
            Tu rol será <strong className="font-semibold text-ink">{roleLabel}</strong>. Crea tu contraseña y
            entras directo.
          </>
        }
      >
        <AcceptInvitationForm token={token} email={preview.email ?? ''} orgName={orgName} />
      </AuthCard>
    </AuthShell>
  )
}

function reasonMessage(reason: string | undefined): string {
  switch (reason) {
    case 'expired':
      return 'La invitación caducó (duran 7 días). Pídele al negocio que te envíe una nueva.'
    case 'revoked':
      return 'El negocio canceló esta invitación.'
    case 'accepted':
      return 'Esta invitación ya se usó. Si eres tú, inicia sesión con tu cuenta.'
    default:
      return 'El enlace no es válido. Revisa que lo hayas copiado completo.'
  }
}
