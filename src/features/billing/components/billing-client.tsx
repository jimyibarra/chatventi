'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AI_TIERS,
  STARTER_PRICE_USD,
  ADDON_DOMAIN_USD,
  ADDON_TEAM_USD,
  PROMO_CODE,
  PROMO_LABEL,
  monthlyTotalUsd,
  aiTierById,
  STATUS_LABELS,
  type AiTierId,
} from '@/features/billing/plans'
import { createCheckoutSession, createPortalSession } from '@/features/billing/actions'

interface Props {
  sub: {
    status: string
    ai_tier: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  active: boolean
}

function money(usd: number): string {
  return `$${usd}`
}

export function BillingClient({ sub, active }: Props) {
  const [aiTier, setAiTier] = useState<AiTierId>('1000')
  const [domain, setDomain] = useState(false)
  const [teamSeats, setTeamSeats] = useState(0)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const total = useMemo(
    () => monthlyTotalUsd({ aiTier, domain, teamSeats }),
    [aiTier, domain, teamSeats]
  )

  function goCheckout() {
    setError('')
    startTransition(async () => {
      const res = await createCheckoutSession({ aiTier, domain, teamSeats })
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
    const tier = aiTierById(sub.ai_tier)
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
          ChatVenti Starter{tier.id !== 'none' ? ` + Recepcionista IA (${tier.detail})` : ''}
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

  // -------- Sin suscripción: calculadora + checkout ----------------------
  return (
    <div className="space-y-6">
      <div className="rounded-card border border-line bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 1</p>
        <h2 className="mt-1 text-lg font-bold text-ink">
          ¿Quieres que ChatVenti responda mensajes con IA?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          WhatsApp, Telegram y widget en tu web. Reserva citas, responde FAQs y escala a humano
          cuando hace falta.
        </p>
        <div className="mt-4 space-y-2">
          {AI_TIERS.map((t) => {
            const selected = aiTier === t.id
            return (
              <button
                key={t.id}
                onClick={() => setAiTier(t.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                  selected
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-line hover:border-brand-200 hover:shadow-card-hover'
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {t.label}
                    {t.popular && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                        Más popular
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-ink-soft">{t.detail}</span>
                </span>
                <span className="font-semibold text-brand-700">
                  {t.priceUsd === 0 ? '+$0' : `+${money(t.priceUsd)}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-card border border-line bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 2</p>
        <h2 className="mt-1 text-lg font-bold text-ink">Extras opcionales</h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-line px-4 py-3 transition-all hover:border-brand-200 hover:shadow-card-hover">
          <span>
            <span className="block font-medium text-ink">Dominio propio</span>
            <span className="text-sm text-ink-soft">Conecta tu dominio con SSL gratis</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="font-semibold text-brand-700">+{money(ADDON_DOMAIN_USD)}</span>
            <input
              type="checkbox"
              checked={domain}
              onChange={(e) => setDomain(e.target.checked)}
              className="h-5 w-5"
            />
          </span>
        </label>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <span>
            <span className="block font-medium text-ink">Cuentas de empleado extra</span>
            <span className="text-sm text-ink-soft">
              2 incluidas · {money(ADDON_TEAM_USD)} por cuenta adicional
            </span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTeamSeats((n) => Math.max(0, n - 1))}
              className="h-8 w-8 rounded-lg border border-line text-lg leading-none text-ink-muted hover:bg-surface"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold text-ink">{teamSeats}</span>
            <button
              type="button"
              onClick={() => setTeamSeats((n) => Math.min(50, n + 1))}
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
            <p className="text-xs uppercase tracking-wide text-ink-faint">Total mensual</p>
            <p className="text-3xl font-bold">
              {money(total)}
              <span className="text-base font-normal text-ink-faint"> /mes</span>
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Base ${STARTER_PRICE_USD} + módulos · usa el código{' '}
              <span className="font-semibold text-white">{PROMO_CODE}</span> y obtén {PROMO_LABEL} ·
              cancela cuando quieras
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
