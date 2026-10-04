'use client'

import { useState, useTransition } from 'react'
import { resolveBillingInquiry } from '../inquiry-actions'
import type { BillingInquiry } from '../service'
import { fmtAmount } from '@/features/billing/plans'
import { Button, Card, StatusChip } from '@/shared/components/ui'

const REASONS: Record<BillingInquiry['reason'], string> = {
  duplicado: 'Cobro duplicado',
  no_reconozco: 'No reconoce el cargo',
  monto: 'Monto incorrecto',
  otro: 'Otro motivo',
}

/** Aclaraciones de pago abiertas (y las resueltas del último mes). Se resuelven en Stripe. */
export function BillingInquiriesPanel({ rows }: { rows: BillingInquiry[] }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  if (rows.length === 0) return null
  const open = rows.filter((r) => r.status === 'open').length

  return (
    <section aria-labelledby="aclaraciones" className="mb-6">
      <h2 id="aclaraciones" className="mb-2.5 flex flex-wrap items-center gap-2 text-[1.15rem] font-bold leading-tight text-ink">
        Aclaraciones de pago
        {open > 0 && <StatusChip tone="wait">{open === 1 ? '1 abierta' : `${open} abiertas`}</StatusChip>}
      </h2>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <Card as="li" key={r.id} className="space-y-1.5" data-testid="inquiry-row">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <p className="min-w-0 flex-1 basis-[14rem] text-[15px] font-semibold text-ink">
                {r.organization}
                <span className="block text-[13.5px] font-normal text-ink-muted">
                  {REASONS[r.reason]} · {r.invoice_number ?? r.stripe_invoice_id}
                  {r.amount !== null && ` · ${fmtAmount(Number(r.amount))} ${(r.currency ?? '').toUpperCase()}`}
                  {r.contact_email && ` · ${r.contact_email}`}
                </span>
              </p>
              {r.status === 'open' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError('')
                      const res = await resolveBillingInquiry(r.id)
                      if (!res.ok) setError(res.error)
                    })
                  }
                >
                  Marcar como resuelta
                </Button>
              ) : (
                <StatusChip tone="done">Resuelta</StatusChip>
              )}
            </div>
            <p className="whitespace-pre-wrap text-[14.5px] text-ink">{r.message}</p>
          </Card>
        ))}
      </ul>
      {error && <p className="mt-2 text-[14px] text-[#a51b18]">{error}</p>}
    </section>
  )
}
