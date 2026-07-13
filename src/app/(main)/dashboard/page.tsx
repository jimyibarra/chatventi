import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { STATUS_LABELS } from '@/features/billing/plans'
import { getSetupChecklist } from '@/features/onboarding/checklist'
import { SetupChecklistCard } from '@/features/onboarding/components/setup-checklist'
import { getPanelMetrics } from '@/features/dashboard/metrics'
import { IaHeroCell } from '@/features/dashboard/components/ia-hero-cell'
import { UpcomingCell } from '@/features/dashboard/components/upcoming-cell'
import { KpiCell } from '@/shared/components/ui/kpi-cell'
import { ButtonLink } from '@/shared/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // --- Onboarding safety-net -----------------------------------------------
  // Si el usuario confirmó su correo pero aún no tiene negocio, lo creamos aquí
  // con los datos "pendientes" guardados en el signup.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const meta = (user.user_metadata ?? {}) as {
      pending_org_name?: string
      pending_owner_name?: string
      pending_country?: string
      pending_city?: string
      pending_phone?: string
      pending_terms_version?: string
    }
    if (meta.pending_org_name) {
      await supabase.rpc('create_organization_with_owner', {
        p_org_name: meta.pending_org_name,
        p_owner_name: meta.pending_owner_name,
        p_country: meta.pending_country,
        p_city: meta.pending_city,
        p_phone: meta.pending_phone,
        p_terms_version: meta.pending_terms_version,
      })
      // Redirigimos en vez de re-consultar: evita el read-after-write lag de
      // Supabase (el SELECT inmediato tras el RPC puede pegar en una réplica
      // que aún no propagó la escritura). El siguiente request lee consistente.
      redirect('/dashboard')
    }
    // Sin perfil y sin onboarding pendiente: cuenta huérfana. Mostramos aviso
    // (NO redirigir a /login: el proxy la devolvería a /dashboard -> bucle).
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-card border border-warn-bg bg-warn-bg p-6 text-sm text-warn">
          Tu cuenta aún no tiene un negocio asociado. Cierra sesión y regístrate
          de nuevo para crear tu negocio.
        </div>
      </div>
    )
  }

  // --- Datos del negocio (RLS los acota a la org del usuario) ----------------
  const { data: org } = await supabase
    .from('organizations')
    .select('name, created_at')
    .maybeSingle()

  const sub = await getMySubscription()
  const active = subIsActive(sub)
  const checklist = await getSetupChecklist(supabase)
  const metrics = await getPanelMetrics(supabase)

  const todayLabel = new Intl.DateTimeFormat('es-MX', {
    timeZone: metrics.tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Panel</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Hola{profile.full_name ? ` ${profile.full_name}` : ''} —{' '}
            <span data-testid="org-name" className="font-medium text-ink-muted">
              {org?.name ?? '—'}
            </span>{' '}
            · {todayLabel}
          </p>
        </div>
        <ButtonLink href="/dashboard/agenda">+ Nueva cita</ButtonLink>
      </div>

      {!active && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-900">
            {sub ? `Tu suscripción está: ${STATUS_LABELS[sub.status] ?? sub.status}. ` : ''}
            Activa tu plan para desbloquear todo ChatVenti. 14 días de prueba gratis.
          </p>
          <ButtonLink href="/dashboard/facturacion" className="text-sm">
            Ver planes
          </ButtonLink>
        </div>
      )}

      {/* Mosaico bento: 4 KPIs arriba, hero IA + próximas citas abajo. */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <KpiCell
          label="Citas hoy"
          value={metrics.citasHoy.value}
          delta={metrics.citasHoy.delta}
          deltaTone={metrics.citasHoy.deltaTone}
          spark={metrics.citasHoy.spark}
        />
        <KpiCell
          label="Conversaciones"
          value={metrics.conversaciones.value}
          delta={metrics.conversaciones.delta}
          deltaTone={metrics.conversaciones.deltaTone}
          spark={metrics.conversaciones.spark}
        />
        {metrics.confirmacion ? (
          <KpiCell
            label="Confirmación"
            value={metrics.confirmacion.value}
            delta={metrics.confirmacion.detail}
            deltaTone="warn"
          />
        ) : (
          <KpiCell label="Confirmación" value="—" delta="Sin citas aún" deltaTone="warn" />
        )}
        <KpiCell
          label="Clientes nuevos"
          value={metrics.clientesNuevos}
          delta="últimos 7 días"
          deltaTone="success"
        />

        <div className="col-span-2">
          <IaHeroCell ia={metrics.ia} />
        </div>
        <div className="col-span-2">
          <UpcomingCell proximas={metrics.proximas} />
        </div>
      </div>

      <SetupChecklistCard checklist={checklist} />
    </div>
  )
}
