import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { runDashboardLifecycleEmails } from '@/features/emails/lifecycle'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { STATUS_LABELS } from '@/features/billing/plans'
import { TRIAL_AI_MESSAGE_CAP } from '@/shared/security/limits'
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

  // --- Red de seguridad del onboarding ---------------------------------------
  // Desde 2026-08-04 el negocio se crea en /bienvenida y el gate del proxy
  // manda allí a toda cuenta sin perfil, así que aquí no debería llegar
  // ninguna. Se conserva la comprobación porque el proxy podría no haber
  // corrido (acceso directo al RSC, despliegue a medias) y sin ella las
  // consultas de abajo devolverían null y el panel se pintaría vacío.
  //
  // Ya NO se crea la organización aquí: el bloque que leía los `pending_*` de
  // user_metadata se retiró con el alta en dos pasos.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/bienvenida')

  // Correos de ciclo de vida (bienvenida / onboarding). En segundo plano con
  // after(): no bloquea el render y es idempotente (marcas en la org).
  after(() => runDashboardLifecycleEmails(user.id))

  // --- Datos del negocio (RLS los acota a la org del usuario) ----------------
  const { data: org } = await supabase
    .from('organizations')
    .select('name, created_at, trial_ai_capped_at')
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

      {/* Tope de IA de la prueba alcanzado. Va ARRIBA del aviso de plan: es
          más urgente, porque significa que el agente ya no está respondiendo
          a los clientes del negocio y el dueño podría no haberse enterado. */}
      {!active && org?.trial_ai_capped_at && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warn-bg bg-warn-bg p-4">
          <p className="text-sm text-warn">
            <span className="font-semibold">Tu recepcionista IA dejó de responder.</span> Alcanzaste
            los {TRIAL_AI_MESSAGE_CAP} mensajes incluidos en la prueba gratis. Activa tu plan para
            que vuelva a atender a tus clientes sin límite.
          </p>
          <ButtonLink href="/dashboard/facturacion" className="text-sm">
            Activar mi plan
          </ButtonLink>
        </div>
      )}

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
