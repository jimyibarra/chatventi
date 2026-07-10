'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AI_TIERS,
  STARTER_PRICE_USD,
  ADDON_DOMAIN_USD,
  ADDON_TEAM_USD,
  TRIAL_DAYS,
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            {STATUS_LABELS[sub.status] ?? sub.status}
          </span>
          {sub.cancel_at_period_end && (
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Se cancela al final del periodo
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-gray-600">Tu plan actual</p>
        <p className="text-lg font-semibold text-gray-900">
          ChatVenti Starter{tier.id !== 'none' ? ` + Recepcionista IA (${tier.detail})` : ''}
        </p>
        {sub.current_period_end && (
          <p className="mt-1 text-sm text-gray-500">
            Próxima renovación: {new Date(sub.current_period_end).toLocaleDateString('es-MX')}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={goPortal}
          disabled={pending}
          className="mt-5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'Abriendo…' : 'Administrar suscripción'}
        </button>
        <p className="mt-2 text-xs text-gray-400">
          Cambia de plan, actualiza tu tarjeta o cancela desde el portal de Stripe.
        </p>
      </div>
    )
  }

  // -------- Sin suscripción: calculadora + checkout ----------------------
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 1</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">
          ¿Quieres que ChatVenti responda mensajes con IA?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
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
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    {t.label}
                    {t.popular && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                        Más popular
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-500">{t.detail}</span>
                </span>
                <span className="font-semibold text-brand-700">
                  {t.priceUsd === 0 ? '+$0' : `+${money(t.priceUsd)}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Paso 2</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">Extras opcionales</h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
          <span>
            <span className="block font-medium text-gray-900">Dominio propio</span>
            <span className="text-sm text-gray-500">Conecta tu dominio con SSL gratis</span>
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
        <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
          <span>
            <span className="block font-medium text-gray-900">Cuentas de empleado extra</span>
            <span className="text-sm text-gray-500">
              2 incluidas · {money(ADDON_TEAM_USD)} por cuenta adicional
            </span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTeamSeats((n) => Math.max(0, n - 1))}
              className="h-8 w-8 rounded-lg border border-gray-300 text-lg leading-none text-gray-700 hover:bg-gray-50"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold text-gray-900">{teamSeats}</span>
            <button
              type="button"
              onClick={() => setTeamSeats((n) => Math.min(50, n + 1))}
              className="h-8 w-8 rounded-lg border border-gray-300 text-lg leading-none text-gray-700 hover:bg-gray-50"
            >
              +
            </button>
          </span>
        </div>
      </div>

      <div className="sticky bottom-4 rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Total mensual</p>
            <p className="text-3xl font-bold">
              {money(total)}
              <span className="text-base font-normal text-gray-400"> /mes</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Base ${STARTER_PRICE_USD} + módulos · {TRIAL_DAYS} días de prueba gratis · cancela
              cuando quieras
            </p>
          </div>
          <button
            onClick={goCheckout}
            disabled={pending}
            className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Redirigiendo…' : 'Empezar prueba gratis'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  )
}
