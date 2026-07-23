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
import { DATA_RETENTION_DAYS } from '@/features/billing/plans'

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
    ? await supabase.from('organizations').select('business_type').eq('id', orgId).maybeSingle()
    : { data: null }
  const active = subIsActive(sub)
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
          Paga solo por lo que usas. Base con agenda, CRM y reservas web; suma el módulo de
          Recepcionista IA cuando lo necesites.
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
                ai_tier: sub.ai_tier,
                current_period_end: sub.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
              }
            : null
        }
        active={active}
        businessType={org?.business_type ?? null}
      />

      {!active && <OnboardingHelpCard />}
    </div>
  )
}
