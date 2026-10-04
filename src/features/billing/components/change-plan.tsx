'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { changePlan } from '@/features/billing/actions'
import {
  ANNUAL_MONTHS_FREE,
  PLANS,
  currencyCode,
  fmtAmount,
  periodPrice,
  planPrice,
  type BillingInterval,
  type Currency,
  type PlanId,
} from '@/features/billing/plans'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { SEGMENT_GROUP, segmentItem } from '@/shared/components/ui/segmented'
import { StatusChip } from '@/shared/components/ui/status-chip'

const OPTION = 'flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-[background-color,box-shadow] duration-150'

/** Cambiar de plan o de periodicidad sin salir de Facturación. */
export function ChangePlan({
  currentPlan,
  currentInterval,
  currency,
}: {
  currentPlan: string | null
  currentInterval: BillingInterval
  currency: Currency
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [interval, setPeriod] = useState<BillingInterval>(currentInterval)
  const [plan, setPlan] = useState<PlanId | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const isCurrent = (id: PlanId) => id === currentPlan && interval === currentInterval
  const chosen = plan && !isCurrent(plan) ? PLANS.find((p) => p.id === plan) : null

  const confirm = () =>
    chosen &&
    startTransition(async () => {
      setError('')
      const res = await changePlan({ plan: chosen.id, interval })
      if (!res.ok) return setError(res.error)
      setDone(true)
      setOpen(false)
      setPlan(null)
      router.refresh()
    })

  if (!open) {
    return (
      <div className="mt-4 space-y-3 border-t border-line pt-4">
        {done && <Notice tone="success">Listo: cambiamos tu plan. El ajuste proporcional aparece en tu historial de pagos.</Notice>}
        <Button variant="secondary" onClick={() => setOpen(true)} data-testid="change-plan-open">
          <Icon name="repeat" />
          Cambiar de plan
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4" data-testid="change-plan">
      <div className={SEGMENT_GROUP} role="group" aria-label="Periodicidad">
        {(['month', 'year'] as const).map((opt) => (
          <button key={opt} type="button" aria-pressed={interval === opt} onClick={() => setPeriod(opt)} className={segmentItem(interval === opt)}>
            {opt === 'month' ? 'Mensual' : `Anual · ${ANNUAL_MONTHS_FREE} meses de regalo`}
          </button>
        ))}
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Plan nuevo">
        {PLANS.map((p) => {
          const current = isCurrent(p.id)
          const selected = plan === p.id && !current
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={current}
              onClick={() => setPlan(p.id)}
              data-testid={`change-plan-${p.id}`}
              className={`${OPTION} ${
                selected ? 'bg-brand-50 shadow-[inset_0_0_0_2px_#2a1a5e]' : 'bg-surface hover:shadow-[inset_0_0_0_2px_#c4bff5]'
              } disabled:cursor-default disabled:hover:shadow-none`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                  {p.name}
                  {current && <StatusChip tone="neutral">Tu plan actual</StatusChip>}
                </span>
                <span className="block text-[13.5px] text-ink-muted">{p.tagline}</span>
              </span>
              <span className="flex-none text-right text-[16px] font-bold tabular-nums text-ink">
                {fmtAmount(periodPrice(planPrice(p, currency), interval))}
                <span className="text-[13px] font-semibold text-ink-muted">
                  {' '}
                  {currencyCode(currency)}/{interval === 'year' ? 'año' : 'mes'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="max-w-[68ch] text-[13.5px] leading-snug text-ink-muted">
        Al cambiar se cobra hoy la parte proporcional del periodo{currency === 'mxn' ? ', más IVA' : ''}. Si bajas de plan, la diferencia
        queda a tu favor y se descuenta de tus siguientes facturas.
      </p>
      {error && (
        <p className="text-[14px] text-[#a51b18]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={confirm} disabled={!chosen || pending} data-testid="change-plan-confirm">
          {pending ? 'Cambiando…' : chosen ? `Cambiar a ${chosen.name}` : 'Elige un plan'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
