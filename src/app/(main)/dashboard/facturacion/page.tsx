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
import { getActiveTrialPromo } from '@/features/billing/promo'
import { billingCurrency } from '@/features/billing/currency'
import { internalPartnerName } from '@/features/socios/service'
import { listPayments } from '@/features/billing/payments'
import { PaymentHistory } from '@/features/billing/components/payment-history'
import { OnboardingHelpCard } from '@/features/marketing/components/onboarding-help-card'
import { DATA_RETENTION_DAYS, type PlanId } from '@/features/billing/plans'
import { UsageCard } from '@/features/billing/components/usage-card'
import { ReferralCard } from '@/features/billing/components/referral-card'
import { LEGAL } from '@/shared/constants/legal'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { Notice } from '@/shared/components/ui/notice'

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
        .select('business_type, referral_code, partner_id, country')
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
  // Socio interno (PASEN): se nombra la plataforma en vez de «tu proveedor».
  const includedIn = org?.partner_id ? await internalPartnerName(org.partner_id) : null

  // Negocio de socio con el acceso en pausa: NO se le ofrece contratar
  // directo con ChatVenti (sería saltarse a quien se lo vendió).
  if (org?.partner_id && !active) {
    return (
      <Page width="narrow">
        <PageHeader title="Facturación" />
        <EmptyState icon="lock" title="Tu acceso está en pausa">
          <span data-testid="partner-paused">
            {includedIn
              ? `Tu recepcionista está incluida en tu suscripción de ${includedIn}. Reactívala desde ${includedIn}: tus datos, tu agenda y tus conversaciones siguen guardados.`
              : 'Tu cuenta la administra el proveedor con el que contrataste el servicio. Escríbele para reactivarla: tus datos, tu agenda y tus conversaciones siguen guardados.'}
          </span>
        </EmptyState>
      </Page>
    )
  }
  // Banner de "prueba terminada" si el acceso está bloqueado (sin éxito reciente).
  // Si lo que falló fue un cobro, el aviso es otro (va arriba, en el layout).
  const paymentPending = sub?.status === 'past_due' || sub?.status === 'unpaid'
  const blocked = !!orgTrial && !hasAppAccess(orgTrial, sub) && !success && !paymentPending

  // Historial de pagos (Stripe) y aclaraciones abiertas, para quien paga con tarjeta.
  const customerId = !managed ? sub?.stripe_customer_id ?? null : null
  const [payments, { data: openInquiries }] = customerId
    ? await Promise.all([
        listPayments(customerId),
        supabase.from('billing_inquiries').select('stripe_invoice_id').eq('organization_id', orgId as string).eq('status', 'open'),
      ])
    : [[], { data: [] as { stripe_invoice_id: string }[] }]
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

  // Moneda de cobro: la de su suscripción si ya paga; si no, la del país del negocio.
  const currency = await billingCurrency({ country: org?.country, subscriptionCurrency: sub?.currency })

  // La promoción se lee de Stripe (con caché); a quien ya paga no se le anuncia.
  const live = active ? null : await getActiveTrialPromo()
  const promo = live && { code: live.code, label: live.label }

  return (
    <Page width="narrow">
      <PageHeader
        title="Facturación"
        subtitle="Elige el plan del tamaño de tu negocio. Todos incluyen el recepcionista IA por WhatsApp, la agenda, el CRM y las reservas web."
      />

      {blocked && <TrialEndedBanner deleteLabel={deleteLabel} promo={promo} />}
      {success && <PostCheckoutSuccess active={active} />}
      {canceled && !success && (
        <Notice tone="info" className="mb-4">
          Cancelaste el proceso de pago. Puedes contratar cuando quieras; no se hizo ningún cargo.
        </Notice>
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
        includedIn={includedIn}
        promo={promo}
        currency={currency}
      />

      {customerId && (
        <PaymentHistory rows={payments} inReview={(openInquiries ?? []).map((i) => i.stripe_invoice_id)} />
      )}

      <UsageCard
        aiReplies={usageRow?.ai_replies ?? 0}
        planId={active || paymentPending ? ((sub?.plan_id ?? null) as PlanId | null) : null}
        managed={managed}
        includedIn={includedIn}
        currency={currency}
      />
      {org?.referral_code && !managed && (
        <ReferralCard
          link={`${LEGAL.siteUrl.replace(/\/$/, '')}/signup?ref=${org.referral_code}`}
          credited={(rewards ?? []).filter((r) => r.status === 'credited').length}
          pending={(rewards ?? []).filter((r) => r.status !== 'credited' && r.status !== 'skipped').length}
        />
      )}

      {!active && !paymentPending && <OnboardingHelpCard currency={currency} />}
    </Page>
  )
}
