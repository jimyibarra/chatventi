import { redirect } from 'next/navigation'
import { Rubik } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { DashboardNav } from '@/shared/components/dashboard-nav'
import { PushNotificationPrompt } from '@/features/notifications/components/push-notification-prompt'
import { dayRangeUtc, ymdInTz } from '@/features/agenda/datetime'
import { getMySubscription, paymentIssue } from '@/features/billing/gating'
import { PaymentIssueBanner } from '@/features/billing/components/payment-issue-banner'
import { brandStyle, currentBrand } from '@/features/marca/brand'
import { BrandProvider } from '@/features/marca/brand-context'
import { brandMetadata } from '@/features/marca/brand-shared'
import type { Metadata } from 'next'
import '@/shared/components/ui/panel.css'

// Tipografía del diseño «Líneas». Solo se carga dentro del panel.
const rubik = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-rubik' })

/** Título, ícono y nombre de app con la marca del socio cuando el negocio es suyo. */
export async function generateMetadata(): Promise<Metadata> {
  return brandMetadata(await currentBrand())
}

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

  // Avisos de la navegación: citas de hoy que faltan por confirmar y chats que
  // la recepcionista pasó a una persona. Dos conteos; la RLS los acota a la
  // organización. Se refrescan con cada router.refresh().
  const { data: branch } = await supabase.from('branches').select('timezone').order('created_at').limit(1).maybeSingle()
  const now = new Date()
  const endOfDay = dayRangeUtc(ymdInTz(now, branch?.timezone ?? 'America/Mexico_City'), branch?.timezone ?? 'America/Mexico_City').to
  const brand = await currentBrand()
  const [unconfirmed, passed, sub] = await Promise.all([
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('starts_at', now.toISOString())
      .lt('starts_at', endOfDay),
    supabase.from('ai_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Solo dueño y gerente leen la suscripción (RLS): el aviso de cobro les
    // llega a quienes pueden pagar; al personal no.
    getMySubscription(),
  ])
  const issue = paymentIssue(sub)

  return (
    <BrandProvider brand={brand}>
    <div className={`${rubik.variable} cv-panel min-h-screen bg-surface font-sans text-ink`} style={brandStyle(brand)}>
      <DashboardNav role={role} badges={{ agenda: unconfirmed.count ?? 0, chats: passed.count ?? 0 }} brandName={brand.name} iconUrl={brand.iconUrl} />
      {/* El riel ocupa 84px a la izquierda (≥md) y la barra 72px abajo (<md). */}
      <div className="pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0 md:pl-[84px]">
        <header className="flex items-center justify-between gap-3 bg-brand-500 px-4 py-2 text-white md:justify-end md:bg-transparent md:px-6 md:pb-0 md:pt-3 md:text-ink-muted">
          <span className="flex items-center gap-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.iconUrl} alt="" className="h-8 w-8 rounded-[10px] bg-white p-1" />
            <span className="font-bold tracking-tight">{brand.name}</span>
          </span>
          <div className="flex min-w-0 items-center gap-3">
            {brand.panelUrl && (
              <a href={brand.panelUrl} className="hidden truncate text-sm font-semibold underline-offset-2 hover:underline sm:inline" data-testid="volver-socio">
                Volver a mi panel de {brand.name}
              </a>
            )}
            <span className="hidden truncate text-sm sm:inline">{user.email}</span>
            <LogoutButton className="rounded-[11px] border border-white/60 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 md:border-line md:text-ink-muted md:hover:bg-white" />
          </div>
        </header>
        {issue && <PaymentIssueBanner state={issue.state} until={issue.until} />}
        <main className="min-w-0">{children}</main>
      </div>
      <PushNotificationPrompt />
    </div>
    </BrandProvider>
  )
}
