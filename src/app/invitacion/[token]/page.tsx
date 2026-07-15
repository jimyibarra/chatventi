import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AcceptInvitationForm } from '@/features/equipo/components/accept-invitation-form'
import { TEAM_ROLES, roleKeyOf } from '@/features/equipo/types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Invitación · ChatVenti' }

type Preview = {
  valid: boolean
  reason?: string
  org_name?: string
  email?: string
  role?: string
  has_account?: boolean
}

// Pantalla pública (patrón de /c/[token]): el invitado aún no tiene cuenta.
// El token es el secreto; la RPC solo expone org, email y rol.
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_invitation_preview', { p_token: token })
  const preview = data as unknown as Preview | null

  const orgName = preview?.org_name ?? 'un negocio'

  if (!preview?.valid) {
    return (
      <Shell>
        <h1 className="mb-2 text-xl font-bold text-ink">Esta invitación no está disponible</h1>
        <p className="text-sm text-ink-muted">{reasonMessage(preview?.reason)}</p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface"
        >
          Ir a iniciar sesión
        </Link>
      </Shell>
    )
  }

  const roleLabel = TEAM_ROLES[roleKeyOf(preview.role ?? 'staff', null)].label

  // Ya tiene cuenta: no podemos crearle otra. Que entre y vuelva al enlace.
  if (preview.has_account) {
    return (
      <Shell>
        <h1 className="mb-2 text-xl font-bold text-ink">Te invitaron a {orgName}</h1>
        <p className="text-sm text-ink-muted">
          Ya tienes una cuenta de ChatVenti con <strong>{preview.email}</strong>. Inicia sesión y
          vuelve a abrir este enlace para unirte al equipo.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-btn hover:bg-brand-600"
        >
          Iniciar sesión
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="mb-1 text-xl font-bold text-ink">Te invitaron a {orgName}</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Tu rol será <strong>{roleLabel}</strong>. Crea tu contraseña y entras directo.
      </p>
      <AcceptInvitationForm token={token} email={preview.email ?? ''} orgName={orgName} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/chatventi-logo.png"
            alt="ChatVenti"
            className="mx-auto h-9 w-auto"
          />
        </div>
        <div className="rounded-card border border-line bg-white p-6">{children}</div>
      </div>
    </div>
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
