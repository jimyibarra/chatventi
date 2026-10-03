import { after } from 'next/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/server'
import { runDashboardLifecycleEmails } from '@/features/emails/lifecycle'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { STATUS_LABELS, TRIAL_DAYS } from '@/features/billing/plans'
import { TRIAL_AI_MESSAGE_CAP } from '@/shared/security/limits'
import { getSetupChecklist } from '@/features/onboarding/checklist'
import { SetupChecklistCard } from '@/features/onboarding/components/setup-checklist'
import { getPanelMetrics } from '@/features/dashboard/metrics'
import { getPanelLineas } from '@/features/lineas/panel-data'
import { durationLabel, hhmm } from '@/features/lineas/model'
import { Legend, LinesDiagram } from '@/features/lineas/components/lines-diagram'
import { IaCard, NextStations, NoticesCard } from '@/features/lineas/components/panel-cards'
import { ButtonLink } from '@/shared/components/ui/button'

export const dynamic = 'force-dynamic'

const CARD = 'rounded-[20px] bg-white p-4 shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)] md:p-5'
const H2 = 'text-[1.15rem] font-bold leading-tight text-ink'

// Panel «Líneas»: responde, en este orden, a "¿qué pasa ahora?", "¿qué me
// toca hacer?", "¿cómo va el día?" y "¿qué hizo la recepcionista por mí?".
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // --- Red de seguridad del onboarding ---------------------------------------
  // El negocio se crea en /bienvenida y el gate del proxy manda allí a toda
  // cuenta sin perfil. Se conserva la comprobación porque el proxy podría no
  // haber corrido (acceso directo al RSC, despliegue a medias) y sin ella las
  // consultas de abajo devolverían null y el panel se pintaría vacío.
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
  const [{ data: org }, sub, checklist, metrics, panel] = await Promise.all([
    supabase.from('organizations').select('name, created_at, trial_ai_capped_at').maybeSingle(),
    getMySubscription(),
    getSetupChecklist(supabase),
    getPanelMetrics(supabase),
    getPanelLineas(supabase),
  ])
  const active = subIsActive(sub)
  // Los avisos de plan solo se le muestran al dueño. La suscripción se lee
  // por RLS y un `staff` no la ve: sin esta condición, al personal de un
  // negocio que SÍ paga le salía "Activa tu plan" en su panel.
  const isOwner = profile.role === 'owner'
  const tz = panel?.tz ?? metrics.tz
  const now = new Date()

  const dateLong = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const clock = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(now)
  const agendaHref = panel ? `/dashboard/agenda?date=${panel.day.date}` : '/dashboard/agenda'
  const gaps = panel
    ? panel.day.lines.flatMap((line) => line.gaps.map((g) => ({ line, g }))).sort((a, b) => a.g.start - b.g.start)
    : []

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-4 md:px-6 md:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink">Panel</h1>
          <p className="truncate text-[15px] text-ink-muted">
            <span data-testid="org-name">{org?.name ?? '—'}</span> · {dateLong}
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-[13px] bg-white px-3.5 py-2 text-[15px] font-semibold tabular-nums text-ink shadow-[0_1px_0_#dde2f0] md:inline-flex" aria-label="Hora actual">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </svg>
          {clock}
        </span>
        <ButtonLink href={`${agendaHref}&new=1`}>+ Nueva cita</ButtonLink>
      </header>

      {/* Tope de IA de la prueba alcanzado. Va ARRIBA del aviso de plan: es
          más urgente, porque significa que el agente ya no está respondiendo
          a los clientes del negocio y el dueño podría no haberse enterado. */}
      {isOwner && !active && org?.trial_ai_capped_at && (
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

      {isOwner && !active && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-900">
            {sub ? `Tu suscripción está: ${STATUS_LABELS[sub.status] ?? sub.status}. ` : ''}
            Activa tu plan para desbloquear todo ChatVenti. {TRIAL_DAYS} días de prueba gratis.
          </p>
          <ButtonLink href="/dashboard/facturacion" className="text-sm">
            Ver planes
          </ButtonLink>
        </div>
      )}

      {panel && (
        <>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section aria-labelledby="h-next" className="min-w-0">
              <h2 id="h-next" className={`${H2} mb-2.5`}>Próxima estación</h2>
              <NextStations items={panel.next} nowMin={panel.day.nowMin ?? 0} agendaHref={agendaHref} />
            </section>
            <NoticesCard unconfirmed={panel.unconfirmed} chats={panel.chats} deposits={panel.deposits} />
          </div>

          <section className={`${CARD} mb-4`} aria-labelledby="h-day">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <h2 id="h-day" className={`${H2} mr-auto`}>El día en líneas</h2>
              <Link
                href={agendaHref}
                className="inline-flex min-h-[40px] items-center rounded-[13px] border-2 border-ink px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50"
              >
                Abrir agenda
              </Link>
            </div>
            <LinesDiagram day={panel.day} mode="panel" />
            <Legend />
          </section>
        </>
      )}

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <IaCard
          enabled={metrics.ia.enabled}
          canToggle={profile.role === 'owner' || profile.role === 'manager'}
          respondidas={metrics.ia.respondidas}
          agendadas={metrics.ia.agendadas}
          pasados={panel?.passedToday ?? metrics.ia.escaladas}
          mesCitas={metrics.ia.mesCitas}
          mesImporte={metrics.ia.mesImporte}
          feed={panel?.feed ?? []}
        />
        <section className={CARD} aria-labelledby="h-gaps">
          <h2 id="h-gaps" className={`${H2} mb-1`}>Huecos libres hoy</h2>
          {gaps.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-muted">
              {panel?.day.lines.some((l) => l.window)
                ? 'No quedan huecos de media hora o más: la agenda de hoy está llena.'
                : 'Configura el horario de tus profesionales para ver aquí sus huecos libres.'}
            </p>
          ) : (
            <ul>
              {gaps.slice(0, 6).map(({ line, g }) => (
                <li
                  key={`${line.id}${g.start}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-0"
                  style={{ '--c': line.color } as CSSProperties}
                >
                  <span className="ln-badge">{line.n}</span>
                  <span className="min-w-0 flex-1 md:w-[120px] md:flex-none">
                    <b className="block truncate text-[15px] font-semibold text-ink">{line.name}</b>
                    <span className="text-[13px] text-ink-muted">{durationLabel(g.end - g.start)}</span>
                  </span>
                  <span className="order-last flex w-full items-center gap-2 text-[15px] font-semibold tabular-nums text-ink md:order-none md:w-auto md:flex-1">
                    {hhmm(g.start)}
                    <i className="ln-gap" style={{ position: 'static', margin: 0, flex: 1, minWidth: 24 }} aria-hidden />
                    {hhmm(g.end)}
                  </span>
                  <Link
                    href={`${agendaHref}&new=1${line.id ? `&resource=${line.id}` : ''}`}
                    className="inline-flex min-h-[40px] items-center rounded-[13px] border-2 border-ink px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50"
                  >
                    + Agendar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* La semana en cuatro cifras: contexto, no tarea. */}
      <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Citas hoy', String(metrics.citasHoy.value), metrics.citasHoy.delta ?? ''],
          ['Conversaciones', String(metrics.conversaciones.value), metrics.conversaciones.delta ?? 'últimos 7 días'],
          ['Confirmación', metrics.confirmacion?.value ?? '—', metrics.confirmacion?.detail ?? 'Sin citas aún'],
          ['Clientes nuevos', String(metrics.clientesNuevos), 'últimos 7 días'],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-[16px] bg-white px-4 py-3 shadow-[0_1px_0_#dde2f0]">
            <dt className="text-[13px] font-semibold text-ink-muted">{label}</dt>
            <dd className="text-[1.6rem] font-bold leading-tight tabular-nums text-ink">{value}</dd>
            <dd className="text-[12.5px] text-ink-muted">{hint}</dd>
          </div>
        ))}
      </dl>

      <SetupChecklistCard checklist={checklist} />
    </div>
  )
}
