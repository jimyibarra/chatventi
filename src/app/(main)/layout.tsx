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

  return (
    <div className="min-h-screen bg-surface">
      {/* En desktop el logo vive en el sidebar; el header solo lleva la cuenta. */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-6 py-3 md:justify-end">
        <span className="font-extrabold tracking-tight text-ink md:hidden">ChatVenti</span>
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
