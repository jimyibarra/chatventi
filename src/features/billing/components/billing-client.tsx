'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  PLANS,
  ANNUAL_MONTHS_FREE,
  monthlyTotal,
  periodPrice,
  planPrice,
  seatPrice,
  currencyCode,
  withIva,
  fmtAmount,
  type Currency,
  planById,
  STATUS_LABELS,
  type BillingInterval,
  type PlanId,
} from '@/features/billing/plans'
import { createCheckoutSession, createPortalSession } from '@/features/billing/actions'
import { businessNoun } from '@/features/marketing/config'
import { Card, Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { SEGMENT_GROUP, segmentItem } from '@/shared/components/ui/segmented'
import { StatusChip } from '@/shared/components/ui/status-chip'

/** Promoción vigente (de Stripe); null = no se anuncia ningún código. */
type Promo = { code: string; label: string } | null

interface Props {
  promo: Promo
  /** Moneda de cobro del negocio (pesos más IVA en México; dólares fuera). */
  currency: Currency
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
  /** Plan administrado por un socio (sin Stripe propio): no hay nada que pagar aquí. */
  managed?: boolean
  /** Socio interno (otra plataforma de Grupo ELRI) cuyo paquete incluye el plan. */
  includedIn?: string | null
}

const money = fmtAmount

// Quiz de 1 pregunta: el tamaño del negocio recomienda un plan.
const SIZE_OPTIONS: { key: string; label: string; hint: string; plan: PlanId }[] = [
  { key: 'solo', label: 'Trabajo solo/a', hint: 'Yo atiendo y yo agendo', plan: 'arranque' },
  { key: 'small', label: 'Somos 2 o 3', hint: 'Un equipo pequeño', plan: 'negocio' },
  { key: 'clinic', label: 'Varios profesionales', hint: 'Clínica, salón o estética', plan: 'profesional' },
  { key: 'multi', label: 'Más de 10 profesionales', hint: 'Un equipo grande con mucho volumen', plan: 'multisede' },
]

/** Marca de opción elegida: aro hueco o punto relleno, como una estación. */
function Pick({ on }: { on: boolean }) {
  return (
    <span
      className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 transition-colors duration-150 ${
        on ? 'border-ink bg-ink text-white' : 'border-[#c9cde0] bg-white'
      }`}
      aria-hidden
    >
      {on && <Icon name="check" className="h-3 w-3" strokeWidth={3.2} />}
    </span>
  )
}

/** Condiciones del total: anual (10 meses por 12) o mensual con el código de promoción. */
function FinePrint({ interval, planName, promo }: { interval: BillingInterval; planName: string; promo: Promo }) {
  if (interval === 'year') {
    return <>Plan {planName} + extras · pagas 10 meses y usas 12 · cancela cuando quieras</>
  }
  if (!promo) return <>Plan {planName} + extras · cancela cuando quieras</>
  return (
    <>
      Plan {planName} + extras · usa el código{' '}
      <span className="rounded-[6px] bg-brand-500/25 px-1.5 font-mono font-semibold">{promo.code}</span> y obtén {promo.label} ·
      cancela cuando quieras
    </>
  )
}

const OPTION ='flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-[background-color,box-shadow] duration-150'
const optionState = (on: boolean) =>
  on ? 'bg-brand-50 shadow-[inset_0_0_0_2px_#2a1a5e]' : 'bg-surface hover:shadow-[inset_0_0_0_2px_#c4bff5]'

export function BillingClient({ sub, active, businessType, managed, includedIn, promo, currency }: Props) {
  const [plan, setPlan] = useState<PlanId>('negocio')
  const [interval, setBillingInterval] = useState<BillingInterval>('month')
  const [quizPick, setQuizPick] = useState<string | null>(null)
  const [extraSeats, setExtraSeats] = useState(0)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const planDef = planById(plan)
  const total = useMemo(
    () => periodPrice(monthlyTotal({ plan, extraSeats, currency }), interval),
    [plan, extraSeats, interval, currency]
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
      <Section
        title="Tu plan"
        badge={
          <>
            <StatusChip tone="ok" size="md">{STATUS_LABELS[sub.status] ?? sub.status}</StatusChip>
            {sub.cancel_at_period_end && <StatusChip tone="off" size="md">Se cancela al final del periodo</StatusChip>}
          </>
        }
      >
        <p className="text-[1.6rem] font-bold leading-tight text-ink">
          {currentName}
          {sub.billing_interval === 'year' && (
            <span className="ml-2 align-middle text-[15px] font-semibold text-ink-muted">· pago anual</span>
          )}
        </p>
        {sub.current_period_end && (
          <p className="mt-1 text-[15px] text-ink-muted">
            Próxima renovación: <span className="tabular-nums">{new Date(sub.current_period_end).toLocaleDateString('es-MX')}</span>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[#a51b18]" role="alert">{error}</p>}
        {managed ? (
          <p className="mt-4 max-w-[62ch] text-[14.5px] text-ink-muted" data-testid="managed-plan">
            {includedIn
              ? `Tu plan está incluido en tu suscripción de ${includedIn}. Para cambiarlo o darlo de baja, hazlo en ${includedIn}: aquí no tienes nada que pagar.`
              : 'Tu plan lo administra el proveedor con el que contrataste. Para cambiarlo o darlo de baja, escríbele a él: aquí no tienes nada que pagar.'}
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={goPortal} disabled={pending}>
              <Icon name="card" />
              {pending ? 'Abriendo…' : 'Administrar suscripción'}
            </Button>
            <p className="text-[13.5px] text-ink-muted">
              Cambia de plan, actualiza tu tarjeta o cancela desde el portal de Stripe.
            </p>
          </div>
        )}
      </Section>
    )
  }

  // -------- Sin suscripción: elegir plan + add-ons + checkout -------------
  const recommended = quizPick ? SIZE_OPTIONS.find((o) => o.key === quizPick) : null

  return (
    <div className="space-y-4">
      {/* Quiz de recomendación: el tamaño del negocio sugiere el plan */}
      <Section
        title={`¿Qué tan grande es ${businessNoun(businessType)}?`}
        description="Todos los planes incluyen el recepcionista IA por WhatsApp. Elige el tamaño y ajustamos abajo."
      >
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tamaño del negocio">
          {SIZE_OPTIONS.map((o) => {
            const picked = quizPick === o.key
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={picked}
                data-testid={`quiz-${o.key}`}
                onClick={() => {
                  setQuizPick(o.key)
                  setPlan(o.plan)
                }}
                className={`${OPTION} ${optionState(picked)}`}
              >
                <Pick on={picked} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{o.label}</span>
                  <span className="block text-[13.5px] text-ink-muted">{o.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        {recommended && (
          <Notice tone="info" size="sm" className="mt-3" testId="quiz-reco">
            Te recomendamos el plan {planById(recommended.plan).name}. Ya lo dejamos marcado abajo y
            el total se actualizó.
          </Notice>
        )}
      </Section>

      <Section
        title="Elige tu plan"
        description="WhatsApp, Telegram y widget en tu web, con IA que agenda sola, en todos los planes."
      >
        {/* Periodicidad: el anual cobra 10 meses y regala 2. */}
        <div className={`${SEGMENT_GROUP} mb-4`} role="group" aria-label="Periodicidad de pago">
          {(['month', 'year'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              data-testid={`interval-${opt}`}
              aria-pressed={interval === opt}
              onClick={() => setBillingInterval(opt)}
              className={segmentItem(interval === opt)}
            >
              {opt === 'month' ? 'Mensual' : `Anual · ${ANNUAL_MONTHS_FREE} meses de regalo`}
            </button>
          ))}
        </div>
        <div className="space-y-2" role="radiogroup" aria-label="Plan">
          {PLANS.map((p) => {
            const selected = plan === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlan(p.id)}
                data-testid={`plan-${p.id}`}
                className={`${OPTION} ${optionState(selected)}`}
              >
                <Pick on={selected} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                    {p.name}
                    {p.popular && <StatusChip tone="brand">Más popular</StatusChip>}
                  </span>
                  <span className="block text-[13.5px] text-ink-muted">{p.tagline}</span>
                </span>
                <span className="flex-none text-right text-[17px] font-bold tabular-nums text-ink">
                  {money(periodPrice(planPrice(p, currency), interval))}
                  <span className="text-[13px] font-semibold text-ink-muted">
                    {' '}
                    {currencyCode(currency)}/{interval === 'year' ? 'año' : 'mes'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <ul className="mt-4 grid gap-x-5 gap-y-1.5 text-[14px] text-ink sm:grid-cols-2">
          {planDef.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-[#d6f5e3] text-[#0b5d36]" aria-hidden>
                <Icon name="check" className="h-3 w-3" strokeWidth={3.2} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Extras opcionales">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-surface px-4 py-3">
          <span className="min-w-0 flex-1 basis-[14rem]">
            <span className="block text-[15px] font-semibold text-ink">Accesos de equipo extra</span>
            <span className="text-[13.5px] text-ink-muted">
              {planDef.maxSeats === null
                ? 'Accesos ilimitados en tu plan'
                : `${planDef.maxSeats} incluido${planDef.maxSeats === 1 ? '' : 's'} · ${money(seatPrice(currency))} ${currencyCode(currency)} por acceso adicional`}
            </span>
          </span>
          <span className="flex items-center gap-1 rounded-[14px] bg-white p-1 shadow-[0_1px_0_#dde2f0]">
            <button
              type="button"
              onClick={() => setExtraSeats((n) => Math.max(0, n - 1))}
              disabled={extraSeats === 0}
              className="grid h-11 w-11 place-items-center rounded-[11px] text-ink transition-colors hover:bg-brand-50 disabled:opacity-40 md:h-9 md:w-9"
              aria-label="Quitar un acceso"
            >
              <Icon name="minus" className="h-4 w-4" strokeWidth={2.6} />
            </button>
            <span className="w-8 text-center text-[17px] font-bold tabular-nums text-ink" aria-live="polite">{extraSeats}</span>
            <button
              type="button"
              onClick={() => setExtraSeats((n) => Math.min(50, n + 1))}
              className="grid h-11 w-11 place-items-center rounded-[11px] text-ink transition-colors hover:bg-brand-50 md:h-9 md:w-9"
              aria-label="Añadir un acceso"
            >
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
            </button>
          </span>
        </div>
      </Section>

      {/* Total pegado abajo; en celular, compacto y por encima de la barra de navegación. */}
      <Card
        tone="ink"
        padded={false}
        className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 px-4 py-3 shadow-[0_18px_40px_-14px_rgba(42,26,94,.55)] md:bottom-4 md:p-5"
      >
        <div className="flex items-center justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#cfc9f5]">
              {interval === 'year' ? 'Total anual' : 'Total mensual'}
            </p>
            <p className="text-[1.6rem] font-bold leading-tight tabular-nums md:text-[2rem]" data-testid="total">
              {money(total)}
              <span className="text-[15px] font-semibold text-[#cfc9f5]">
                {' '}
                {currencyCode(currency)}/{interval === 'year' ? 'año' : 'mes'}
              </span>
            </p>
            {currency === 'mxn' && (
              <p className="text-[13px] font-semibold text-[#cfc9f5] tabular-nums" data-testid="total-iva">
                Más IVA · {money(withIva(total))} en total
              </p>
            )}
            <p className="mt-1 hidden max-w-[52ch] text-[13px] leading-snug text-[#dcd8f7] md:block">
              <FinePrint interval={interval} planName={planDef.name} promo={promo} />
            </p>
          </div>
          <Button onClick={goCheckout} disabled={pending} className="md:min-w-[12rem]">
            {pending ? 'Redirigiendo…' : 'Suscribirme ahora'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-[#ffcd2e]" role="alert">{error}</p>}
      </Card>
      {/* En celular la letra pequeña va fuera de la barra pegada, para no tapar la pantalla. */}
      <p className="rounded-[16px] bg-white px-4 py-3 text-[13px] leading-snug text-ink-muted shadow-[0_1px_0_#dde2f0] md:hidden">
        <FinePrint interval={interval} planName={planDef.name} promo={promo} />
      </p>
    </div>
  )
}
