'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addClientRecord, deleteClientRecord } from '../actions'
import { RECORD_KIND_META, type ClientRecord, type RecordKind } from '../types'
import { Inset, Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Select, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { fmtMoney } from '@/shared/lib/format'

const KIND_TONE: Record<RecordKind, ChipTone> = { service: 'brand', purchase: 'ok', note: 'neutral' }

function dateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

// <input type="datetime-local"> quiere hora LOCAL sin zona; el valor se
// convierte a ISO con offset al guardar (la BD guarda timestamptz).
function localNowValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Historial de atención escrito por el negocio: qué se hizo y qué se vendió,
 * con fecha y hora. Complementa el historial de citas (que es automático).
 */
export function ClientRecords({
  clientId,
  records,
}: {
  clientId: string
  records: ClientRecord[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<RecordKind>('service')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [occurredAt, setOccurredAt] = useState(localNowValue())
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    const amountNum = amount.trim() === '' ? undefined : Number(amount)
    if (amountNum !== undefined && Number.isNaN(amountNum)) {
      setError('El importe no es un número válido.')
      return
    }
    startTransition(async () => {
      const res = await addClientRecord({
        clientId,
        kind,
        title,
        detail: detail.trim() || undefined,
        amount: amountNum,
        occurredAt: new Date(occurredAt).toISOString(),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTitle('')
      setDetail('')
      setAmount('')
      setOccurredAt(localNowValue())
      setOpen(false)
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteClientRecord(id, clientId)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <Section
      title="Historial de atención"
      description="Lo que le hiciste o le vendiste, con su fecha. Queda en su expediente."
      actions={
        <Button
          variant={open ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          data-testid="record-toggle"
          aria-expanded={open}
        >
          {open ? 'Cerrar' : (
            <>
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
              Agregar
            </>
          )}
        </Button>
      }
    >
      {open && (
        <Inset className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value as RecordKind)} data-testid="record-kind">
                <option value="service">Servicio</option>
                <option value="purchase">Compra</option>
                <option value="note">Nota</option>
              </Select>
            </Field>
            <Field label="Qué se hizo o se vendió">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Limpieza dental, shampoo…" data-testid="record-title" />
            </Field>
          </div>
          <Field label="Detalle (opcional)">
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              placeholder="Observaciones, indicaciones, material usado…"
              data-testid="record-detail"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cuándo">
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} data-testid="record-when" />
            </Field>
            <Field label="Importe (opcional)">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="150" data-testid="record-amount" className="tabular-nums" />
            </Field>
          </div>
          <Button onClick={add} disabled={pending || !title.trim()} data-testid="record-save">
            {pending ? 'Guardando…' : 'Guardar en el expediente'}
          </Button>
        </Inset>
      )}

      {error && <p className="mb-3 text-sm text-[#a51b18]" role="alert">{error}</p>}

      {records.length === 0 ? (
        <p className="text-[14.5px] text-ink-muted">Sin registros todavía. Agrega el primero después de su próxima visita.</p>
      ) : (
        <ul className="divide-y divide-line">
          {records.map((r) => {
            const meta = RECORD_KIND_META[r.kind as RecordKind] ?? RECORD_KIND_META.note
            const tone = KIND_TONE[r.kind as RecordKind] ?? 'neutral'
            return (
              <li key={r.id} className="flex items-start gap-x-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={tone}>{meta.label}</StatusChip>
                    <span className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{r.title}</span>
                    {r.amount !== null ? (
                      <span className="text-[15px] font-semibold tabular-nums text-ink-muted">{fmtMoney(Number(r.amount))}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] tabular-nums text-ink-muted">{dateTimeLabel(r.occurred_at)}</p>
                  {r.detail && <p className="mt-1 max-w-[65ch] text-[14px] leading-snug text-ink-muted">{r.detail}</p>}
                </div>
                <Button variant="danger" size="sm" onClick={() => remove(r.id)} disabled={pending} aria-label="Eliminar registro">
                  <Icon name="trash" className="h-4 w-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
