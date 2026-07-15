import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { DashboardNav } from '@/shared/components/dashboard-nav'
import { PushNotificationPrompt } from '@/features/notifications/components/push-notification-prompt'

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

  // El rol decide qué secciones se MUESTRAN (cosmético). El bloqueo real de
  // Facturación/Conexiones/Equipo vive en el proxy, que corre en cada
  // navegación, y en las RPCs, que son la barrera de verdad.
  const role = adminProfile?.role ?? 'staff'

  // El gate de acceso (prueba vencida sin suscripción → redirige a Facturación)
  // vive en el proxy/middleware, que corre en CADA navegación (los layouts no
  // se re-renderizan en soft-nav).

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
        <DashboardNav role={role} />
        {/* pb-16 en móvil: que la bottom-nav no tape el contenido */}
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <PushNotificationPrompt />
    </div>
  )
}
