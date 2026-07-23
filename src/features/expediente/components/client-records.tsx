'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addClientRecord, deleteClientRecord } from '../actions'
import { RECORD_KIND_META, type ClientRecord, type RecordKind } from '../types'

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
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Historial de atención</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid="record-toggle"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface"
        >
          {open ? 'Cerrar' : '+ Agregar'}
        </button>
      </div>
      <p className="mb-3 text-sm text-ink-faint">
        Lo que le hiciste o le vendiste, con su fecha. Queda en su expediente.
      </p>

      {open && (
        <div className="mb-4 space-y-2 rounded-xl border border-line bg-surface p-3">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as RecordKind)}
              data-testid="record-kind"
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="service">Servicio</option>
              <option value="purchase">Compra</option>
              <option value="note">Nota</option>
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qué se hizo o se vendió"
              data-testid="record-title"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            placeholder="Detalle (opcional): observaciones, indicaciones, material usado…"
            data-testid="record-detail"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Cuándo</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                data-testid="record-when"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Importe (opcional)
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="150"
                data-testid="record-amount"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={pending || !title.trim()}
            data-testid="record-save"
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      {records.length === 0 ? (
        <p className="text-sm text-ink-faint">Sin registros todavía.</p>
      ) : (
        <ul className="divide-y divide-line-row">
          {records.map((r) => {
            const meta = RECORD_KIND_META[r.kind as RecordKind] ?? RECORD_KIND_META.note
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    <span className={`mr-2 rounded-full border px-2 py-0.5 text-xs ${meta.badge}`}>
                      {meta.label}
                    </span>
                    {r.title}
                    {r.amount !== null ? (
                      <span className="ml-2 text-ink-muted">${r.amount}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-faint">{dateTimeLabel(r.occurred_at)}</p>
                  {r.detail && <p className="mt-0.5 text-xs text-ink-muted">{r.detail}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={pending}
                  className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-rose-600 hover:bg-surface disabled:opacity-50"
                >
                  Eliminar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
