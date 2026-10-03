'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setDepositStatus } from '../actions'
import { DEPOSIT_LABEL, DEPOSIT_NEXT, DEPOSIT_TONE, isDepositStatus, money } from '../labels'
import { Button, Inset, StatusChip } from '@/shared/components/ui'

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
    <div data-testid="deposit-block">
      <Inset className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 text-[15px]">
          <span className="font-semibold tabular-nums text-ink">Anticipo {money(amount)}</span>
          <StatusChip tone={DEPOSIT_TONE[status]}>{DEPOSIT_LABEL[status]}</StatusChip>
        </p>
        {until && (
          <p className="text-[13px] text-ink-muted">Si no llega el comprobante antes de las {until}, el horario se libera.</p>
        )}
        {DEPOSIT_NEXT[status].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {DEPOSIT_NEXT[status].map((t) => (
              <Button
                key={t.to}
                variant="secondary"
                size="sm"
                onClick={() => move(t.to)}
                disabled={pending}
                data-testid={`deposit-${t.to}`}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
        {error && <p className="text-[13px] text-[#a51b18]">{error}</p>}
      </Inset>
    </div>
  )
}
