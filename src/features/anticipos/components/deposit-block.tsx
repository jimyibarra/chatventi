'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setDepositStatus } from '../actions'
import { DEPOSIT_LABEL, DEPOSIT_NEXT, DEPOSIT_TONE, isDepositStatus, money } from '../labels'
import '@/features/lineas/lineas.css'

/** Anticipo de una cita dentro del detalle: estado y lo que se puede hacer. */
export function DepositBlock({
  appointmentId,
  status,
  amount,
  holdUntil,
  tz,
}: {
  appointmentId: string
  status: string | null
  amount: number | string | null
  holdUntil: string | null
  tz: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  if (!isDepositStatus(status)) return null

  const until =
    status === 'pending' && holdUntil
      ? new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(
          new Date(holdUntil)
        )
      : null

  function move(to: string) {
    setError('')
    startTransition(async () => {
      const res = await setDepositStatus({ appointmentId, to })
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  return (
    <div className="ln rounded-[14px] bg-surface p-3" data-testid="deposit-block">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">Anticipo {money(amount)}</span>
        <span className="ln-chip" data-st={DEPOSIT_TONE[status]}>
          {DEPOSIT_LABEL[status]}
        </span>
      </p>
      {until && <p className="mt-1 text-xs text-ink-muted">Si no llega el comprobante antes de las {until}, el horario se libera.</p>}
      {DEPOSIT_NEXT[status].length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {DEPOSIT_NEXT[status].map((t) => (
            <button
              key={t.to}
              type="button"
              onClick={() => move(t.to)}
              disabled={pending}
              data-testid={`deposit-${t.to}`}
              className="rounded-[10px] border-2 border-ink bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-50 disabled:opacity-60"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
