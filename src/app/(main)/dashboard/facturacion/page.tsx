import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getMySubscription,
  getMyOrgTrial,
  subIsActive,
  hasAppAccess,
} from '@/features/billing/gating'
import { BillingClient } from '@/features/billing/components/billing-client'
import { PostCheckoutSuccess } from '@/features/billing/components/post-checkout'
import { TrialEndedBanner } from '@/features/billing/components/subscription-required'
import { OnboardingHelpCard } from '@/features/marketing/components/onboarding-help-card'
import { DATA_RETENTION_DAYS, type PlanId } from '@/features/billing/plans'
import { UsageCard } from '@/features/billing/components/usage-card'
import { ReferralCard } from '@/features/billing/components/referral-card'
import { LEGAL } from '@/shared/constants/legal'

export const dynamic = 'force-dynamic'

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; bloqueado?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { success, canceled } = await searchParams
  const [sub, orgTrial, { data: orgId }] = await Promise.all([
    getMySubscription(),
    getMyOrgTrial(),
    supabase.rpc('get_my_org'),
  ])
  const { data: org } = orgId
    ? await supabase
        .from('organizations')
        .select('business_type, referral_code, partner_id')
        .eq('id', orgId)
        .maybeSingle()
    : { data: null }

  // Consumo del mes y recompensas por recomendar. Ambas tablas se leen por
  // RLS (solo dueño y gerente), con el filtro de organización explícito.
  const period = `${new Date().toISOString().slice(0, 7)}-01`
  const [{ data: usageRow }, { data: rewards }] = orgId
    ? await Promise.all([
        supabase
          .from('usage_periods')
          .select('ai_replies')
          .eq('organization_id', orgId)
          .eq('period_start', period)
          .maybeSingle(),
        supabase.from('referral_rewards').select('status').eq('referrer_org', orgId),
      ])
    : [{ data: null }, { data: null }]
  const active = subIsActive(sub)
  // Negocio dado de alta por un socio: tiene plan activo pero no Stripe propio.
  const managed = active && !sub?.stripe_customer_id

  // Negocio de socio con el acceso en pausa: NO se le ofrece contratar
  // directo con ChatVenti (sería saltarse a quien se lo vendió).
  if (org?.partner_id && !active) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold text-ink">Tu acceso está en pausa</h1>
        <p className="mt-3 text-ink-soft" data-testid="partner-paused">
          Tu cuenta la administra el proveedor con el que contrataste el servicio. Escríbele para
          reactivarla: tus datos, tu agenda y tus conversaciones siguen guardados.
        </p>
      </div>
    )
  }
  // Banner de "prueba terminada" si el acceso está bloqueado (sin éxito reciente).
  const blocked = !!orgTrial && !hasAppAccess(orgTrial, sub) && !success
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

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Facturación</h1>
        <p className="mt-1 text-ink-muted">
          Elige el plan del tamaño de tu negocio. Todos incluyen el recepcionista IA por
          WhatsApp, la agenda, el CRM y las reservas web.
        </p>
      </div>

      {blocked && <TrialEndedBanner deleteLabel={deleteLabel} />}
      {success && <PostCheckoutSuccess active={active} />}
      {canceled && !success && (
        <div className="mb-6 rounded-card border border-warn-bg bg-warn-bg p-4 text-sm text-warn">
          Cancelaste el proceso de pago. Puedes contratar cuando quieras; no se hizo ningún cargo.
        </div>
      )}

      <BillingClient
        sub={
          sub
            ? {
                status: sub.status,
                plan_id: sub.plan_id,
                ai_tier: sub.ai_tier,
                current_period_end: sub.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
                billing_interval: sub.billing_interval,
              }
            : null
        }
        active={active}
        businessType={org?.business_type ?? null}
        managed={managed}
      />

      <UsageCard
        aiReplies={usageRow?.ai_replies ?? 0}
        planId={active ? ((sub?.plan_id ?? null) as PlanId | null) : null}
        managed={managed}
      />
      {org?.referral_code && !managed && (
        <ReferralCard
          link={`${LEGAL.siteUrl.replace(/\/$/, '')}/signup?ref=${org.referral_code}`}
          credited={(rewards ?? []).filter((r) => r.status === 'credited').length}
          pending={(rewards ?? []).filter((r) => r.status !== 'credited' && r.status !== 'skipped').length}
        />
      )}

      {!active && <OnboardingHelpCard />}
    </div>
  )
}
