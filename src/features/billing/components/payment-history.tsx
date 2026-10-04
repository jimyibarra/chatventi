'use client'

import { useState, useTransition } from 'react'
import { requestPaymentClarification } from '@/features/billing/clarify-actions'
import { fmtAmount } from '@/features/billing/plans'
import type { PaymentRow } from '@/features/billing/payments'
import { Section } from '@/shared/components/ui/card'
import { Button, buttonClass } from '@/shared/components/ui/button'
import { Field, Select, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'

const STATUS: Record<string, { tone: ChipTone; label: string }> = {
  paid: { tone: 'ok', label: 'Pagado' },
  open: { tone: 'wait', label: 'Pendiente de pago' },
  void: { tone: 'off', label: 'Anulado' },
  uncollectible: { tone: 'noshow', label: 'No cobrado' },
}

const REASONS: { value: string; label: string }[] = [
  { value: 'duplicado', label: 'Me cobraron dos veces' },
  { value: 'no_reconozco', label: 'No reconozco este cargo' },
  { value: 'monto', label: 'El monto no es el correcto' },
  { value: 'otro', label: 'Otro motivo' },
]

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).format(
    new Date(iso)
  )

function ClarifyForm({ row, onDone, onCancel }: { row: PaymentRow; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('duplicado')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const send = () =>
    startTransition(async () => {
      setError('')
      const res = await requestPaymentClarification({ invoiceId: row.id, reason, message })
      if (!res.ok) return setError(res.error)
      onDone()
    })
  return (
    <div className="mt-3 grid gap-3 rounded-[14px] bg-surface p-3.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <Field label="¿Qué pasó?">
        <Select id={`motivo-${row.id}`} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cuéntanos los detalles" hint="Te respondemos al correo de tu cuenta.">
        <Textarea
          id={`detalle-${row.id}`}
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Por ejemplo: aparece dos veces el cargo del 4 de octubre en mi estado de cuenta."
        />
      </Field>
      {error && <p className="text-[14px] text-[#a51b18] sm:col-span-2" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" onClick={send} disabled={pending || message.trim().length < 5}>
          {pending ? 'Enviando…' : 'Enviar aclaración'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/** Historial de pagos con recibo, pago pendiente y «Aclarar este pago». */
export function PaymentHistory({ rows, inReview }: { rows: PaymentRow[]; inReview: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const review = new Set([...inReview, ...sent])

  return (
    <Section
      id="pagos"
      title="Historial de pagos"
      description="Tus cobros de ChatVenti. Abre el recibo para descargarlo; si algo no cuadra, pide una aclaración y la revisamos."
      className="mt-4 scroll-mt-4"
    >
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-muted">Todavía no hay pagos. Aparecerán aquí desde tu primer cobro.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const st = STATUS[r.status] ?? { tone: 'neutral' as ChipTone, label: r.status }
            return (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0" data-testid="payment-row">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
                  <div className="min-w-0 flex-1 basis-[14rem]">
                    <p className="truncate text-[15px] font-semibold text-ink">{r.concept}</p>
                    <p className="text-[13.5px] text-ink-muted">
                      {fmtDate(r.date)}
                      {r.number && ` · ${r.number}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[16px] font-bold tabular-nums text-ink">
                      {fmtAmount(r.total)} <span className="text-[13px] font-semibold text-ink-muted">{r.currency.toUpperCase()}</span>
                    </p>
                    <StatusChip tone={st.tone}>{st.label}</StatusChip>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.status === 'open' && r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
                      <Icon name="card" />
                      Pagar ahora
                    </a>
                  )}
                  {r.url && r.status !== 'open' && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                      <Icon name="file" />
                      Ver recibo
                    </a>
                  )}
                  {review.has(r.id) ? (
                    <StatusChip tone="brand">Aclaración en revisión</StatusChip>
                  ) : (
                    openId !== r.id && (
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)} data-testid="clarify-open">
                        Aclarar este pago
                      </Button>
                    )
                  )}
                </div>
                {openId === r.id && !review.has(r.id) && (
                  <ClarifyForm
                    row={r}
                    onCancel={() => setOpenId(null)}
                    onDone={() => {
                      setSent((s) => [...s, r.id])
                      setOpenId(null)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {sent.length > 0 && (
        <Notice tone="success" className="mt-3">
          Recibimos tu aclaración. La revisamos y te escribimos al correo de tu cuenta.
        </Notice>
      )}
    </Section>
  )
}
