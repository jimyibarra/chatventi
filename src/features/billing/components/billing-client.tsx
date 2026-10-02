'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  PLANS,
  ADDON_SEAT_USD,
  ANNUAL_MONTHS_FREE,
  PROMO_CODE,
  PROMO_LABEL,
  monthlyTotalUsd,
  periodPriceUsd,
  planById,
  STATUS_LABELS,
  type BillingInterval,
  type PlanId,
} from '@/features/billing/plans'
import { createCheckoutSession, createPortalSession } from '@/features/billing/actions'
import { businessNoun } from '@/features/marketing/config'

interface Props {
  sub: {
    status: string
    plan_id: string | null
    ai_tier: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    billing_interval?: string | null
  } | null
  active: boolean
  businessType?: string | null
}

function money(usd: number): string {
  return `$${usd}`
}

// Quiz de 1 pregunta: el tamaño del negocio recomienda un plan.
const SIZE_OPTIONS: { key: string; label: string; hint: string; plan: PlanId }[] = [
  { key: 'solo', label: 'Trabajo solo/a', hint: 'Yo atiendo y yo agendo', plan: 'arranque' },
  { key: 'small', label: 'Somos 2 o 3', hint: 'Un equipo pequeño', plan: 'negocio' },
  { key: 'clinic', label: 'Varios profesionales', hint: 'Clínica, salón o estética', plan: 'profesional' },
  { key: 'multi', label: 'Más de 10 profesionales', hint: 'Un equipo grande con mucho volumen', plan: 'multisede' },
]

export function BillingClient({ sub, active, businessType }: Props) {
  const [plan, setPlan] = useState<PlanId>('negocio')
  const [interval, setBillingInterval] = useState<BillingInterval>('month')
  const [quizPick, setQuizPick] = useState<string | null>(null)
  const [extraSeats, setExtraSeats] = useState(0)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const planDef = planById(plan)
  const total = useMemo(
    () => periodPriceUsd(monthlyTotalUsd({ plan, extraSeats }), interval),
    [plan, extraSeats, interval]
  )

  function goCheckout() {
    setError('')
    startTransition(async () => {
      const res = await createCheckoutSession({ plan, interval, extraSeats })
      if (!res.ok) {
        setError(res.error)
        return
      }
      window.location.href = res.url
    })
  }

  function goPortal() {
    setError('')
    startTransition(async () => {
      const res = await createPortalSession()
      if (!res.ok) {
        setError(res.error)
        return
      }
      window.location.href = res.url
    })
  }

  // -------- Suscripción vigente: mostrar estado + portal ------------------
  if (active && sub) {
    // plan_id nuevo si existe; si no, nombre aproximado del catálogo legado.
    const currentName = sub.plan_id
      ? `ChatVenti ${planById(sub.plan_id).name}`
      : sub.ai_tier !== 'none'
        ? 'ChatVenti Starter + Recepcionista IA'
        : 'ChatVenti Starter'
    return (
      <div className="rounded-card border border-line bg-white p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">
            {STATUS_LABELS[sub.status] ?? sub.status}
          </span>
          {sub.cancel_at_period_end && (
            <span className="inline-flex rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn">
              Se cancela al final del periodo
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-ink-muted">Tu plan actual</p>
        <p className="text-lg font-semibold text-ink">
          {currentName}
          {sub.billing_interval === 'year' && (
            <span className="ml-2 text-sm font-medium text-ink-muted">· pago anual</span>
          )}
        </p>
        {sub.current_period_end && (
          <p className="mt-1 text-sm text-ink-soft">
            Próxima renovación: {new Date(sub.current_period_end).toLocaleDateString('es-MX')}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={goPortal}
          disabled={pending}
          className="mt-5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? 'Abriendo…' : 'Administrar suscripción'}
        </button>
        <p className="mt-2 text-xs text-ink-faint">
          Cambia de plan, actualiza tu tarjeta o cancela desde el portal de Stripe.
        </p>
      </div>
    )
  }

  // -------- Sin suscripción: elegir plan + add-ons + checkout -------------
  const recommended = quizPick ? SIZE_OPTIONS.find((o) => o.key === quizPick) : null

  return (
    <div className="space-y-6">
      {/* Quiz de recomendación: el tamaño del negocio sugiere el plan */}
      <div className="rounded-card border border-brand-200 bg-brand-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Te ayudamos a elegir
        </p>
        <h2 className="mt-1 text-lg font-bold text-ink">
          ¿Qué tan grande es {businessNoun(businessType)}?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Todos los planes incluyen el recepcionista IA por WhatsApp. Elige el tamaño y ajustamos
          abajo.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {SIZE_OPTIONS.map((o) => {
            const picked = quizPick === o.key
            return (
              <button
                key={o.key}
                type="button"
                data-testid={`quiz-${o.key}`}
                onClick={() => {
                  setQuizPick(o.key)
                  setPlan(o.plan)
                }}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  picked
                    ? 'border-brand-600 bg-white ring-1 ring-brand-600'
                    : 'border-brand-200 bg-white/70 hover:border-brand-400'
                }`}
              >
                <span className="block font-medium text-ink">{o.label}</span>
                <span className="text-sm text-ink-soft">{o.hint}</span>
              </button>
            )
          })}
        </div>
        {recommended && (
          <p className="mt-3 text-sm text-brand-700" data-testid="quiz-reco">
            Te recomendamos el plan {planById(recommended.plan).name}. Ya lo dejamos marcado abajo —
            el total se actualizó.
          </p>
        )}
      </div>

      <div className="rounded-card border border-line bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 1</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Elige tu plan</h2>
        <p className="mt-1 text-sm text-ink-soft">
          WhatsApp, Telegram y widget en tu web, con IA que agenda sola, en todos los planes.
        </p>
        {/* Periodicidad: el anual cobra 10 meses y regala 2. */}
        <div className="mt-4 inline-flex rounded-xl border border-line bg-surface p-1" role="group" aria-label="Periodicidad de pago">
          {(['month', 'year'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              data-testid={`interval-${opt}`}
              aria-pressed={interval === opt}
              onClick={() => setBillingInterval(opt)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                interval === opt ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {opt === 'month' ? 'Mensual' : `Anual · ${ANNUAL_MONTHS_FREE} meses de regalo`}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {PLANS.map((p) => {
            const selected = plan === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                data-testid={`plan-${p.id}`}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                  selected
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-line hover:border-brand-200 hover:shadow-card-hover'
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {p.name}
                    {p.popular && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                        Más popular
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-ink-soft">{p.tagline}</span>
                </span>
                <span className="shrink-0 font-semibold text-brand-700">
                  {money(periodPriceUsd(p.priceUsd, interval))}/{interval === 'year' ? 'año' : 'mes'}
                </span>
              </button>
            )
          })}
        </div>
        <ul className="mt-4 grid gap-1 text-sm text-ink-soft sm:grid-cols-2">
          {planDef.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <span aria-hidden className="mt-0.5 text-success">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-line bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 2</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Extras opcionales</h2>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <span>
            <span className="block font-medium text-ink">Accesos de equipo extra</span>
            <span className="text-sm text-ink-soft">
              {planDef.maxSeats === null
                ? 'Accesos ilimitados en tu plan'
                : `${planDef.maxSeats} incluido${planDef.maxSeats === 1 ? '' : 's'} · ${money(ADDON_SEAT_USD)} por acceso adicional`}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExtraSeats((n) => Math.max(0, n - 1))}
              className="h-8 w-8 rounded-lg border border-line text-lg leading-none text-ink-muted hover:bg-surface"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold text-ink">{extraSeats}</span>
            <button
              type="button"
              onClick={() => setExtraSeats((n) => Math.min(50, n + 1))}
              className="h-8 w-8 rounded-lg border border-line text-lg leading-none text-ink-muted hover:bg-surface"
            >
              +
            </button>
          </span>
        </div>
      </div>

      <div className="sticky bottom-4 rounded-card border border-ink bg-ink p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              {interval === 'year' ? 'Total anual' : 'Total mensual'}
            </p>
            <p className="text-3xl font-bold" data-testid="total">
              {money(total)}
              <span className="text-base font-normal text-ink-faint">
                {' '}
                /{interval === 'year' ? 'año' : 'mes'}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {interval === 'year' ? (
                <>
                  Plan {planDef.name} + extras · pagas 10 meses y usas 12 · cancela cuando quieras
                </>
              ) : (
                <>
                  Plan {planDef.name} + extras · usa el código{' '}
                  <span className="font-semibold text-white">{PROMO_CODE}</span> y obtén {PROMO_LABEL} ·
                  cancela cuando quieras
                </>
              )}
            </p>
          </div>
          <button
            onClick={goCheckout}
            disabled={pending}
            className="rounded-xl bg-brand-500 px-6 py-3 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? 'Redirigiendo…' : 'Suscribirme ahora'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  )
}
