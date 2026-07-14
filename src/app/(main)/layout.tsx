import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { DashboardNav } from '@/shared/components/dashboard-nav'
import { PushNotificationPrompt } from '@/features/notifications/components/push-notification-prompt'
import {
  getMyOrgTrial,
  getMySubscription,
  hasAppAccess,
} from '@/features/billing/gating'
import { SubscriptionRequired } from '@/features/billing/components/subscription-required'
import { DATA_RETENTION_DAYS } from '@/features/billing/plans'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Doble guardia (ademas del middleware): sin sesion -> login.
  if (!user) {
    redirect('/login')
  }

  // El super_admin no es un tenant (no tiene organización): su lugar es /admin.
  // Sin esto, el dashboard de cliente asumiría una org y fallaría.
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (adminProfile?.role === 'super_admin') {
    redirect('/admin')
  }

  // Gate de acceso: prueba gratis vigente o suscripción activa. Al terminar la
  // prueba sin suscripción, se bloquea el panel (pero se permite Facturación
  // para poder pagar). Los datos se conservan hasta el borrado del día 30.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const onBilling = pathname.startsWith('/dashboard/facturacion')
  const [orgTrial, sub] = await Promise.all([getMyOrgTrial(), getMySubscription()])
  // Solo bloqueamos si la org EXISTE (si aún no hay org, el usuario acaba de
  // confirmar su correo y el dashboard creará el negocio: no bloquear ahí).
  if (orgTrial && !hasAppAccess(orgTrial, sub) && !onBilling) {
    const deleteIso =
      orgTrial?.delete_scheduled_at ??
      (orgTrial?.created_at
        ? new Date(new Date(orgTrial.created_at).getTime() + DATA_RETENTION_DAYS * 86400000).toISOString()
        : null)
    const deleteLabel = deleteIso
      ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(deleteIso)
        )
      : null
    return <SubscriptionRequired deleteLabel={deleteLabel} />
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* En desktop el logo vive en el sidebar; el header solo lleva la cuenta. */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-3 md:justify-end">
        <span className="flex items-center gap-2 md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/chatventi-icon.png" alt="" className="h-7 w-7" />
          <span className="font-extrabold tracking-tight text-ink">ChatVenti</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-soft">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="md:flex">
        <DashboardNav />
        {/* pb-16 en móvil: que la bottom-nav no tape el contenido */}
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <PushNotificationPrompt />
    </div>
  )
}
