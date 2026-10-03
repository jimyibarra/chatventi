'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveServiceDeposit } from '../actions'
import { money } from '../labels'

type Kind = 'none' | 'fixed' | 'percent'

/** Anticipo de un servicio, editable en su propia fila. */
export function ServiceDepositControl({
  serviceId,
  type,
  value,
  price,
}: {
  serviceId: string
  type: string | null
  value: number | string | null
  price: number | string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const initialKind = (type === 'fixed' || type === 'percent' ? type : 'none') as Kind
  const [kind, setKind] = useState<Kind>(initialKind)
  const [amount, setAmount] = useState(value != null ? String(value) : '')
  const [error, setError] = useState('')
  const dirty = kind !== initialKind || (kind !== 'none' && amount !== (value != null ? String(value) : ''))

  // Lo que pagaría el cliente con los datos actuales (para que el dueño lo vea claro).
  const preview =
    kind === 'fixed' && Number(amount) > 0
      ? money(amount)
      : kind === 'percent' && Number(amount) > 0 && price != null
        ? money((Number(price) * Number(amount)) / 100)
        : null

  function save() {
    setError('')
    startTransition(async () => {
      const res = await saveServiceDeposit({ serviceId, type: kind, value: kind === 'none' ? null : amount })
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  return (
    <span className="flex flex-wrap items-center gap-2" data-testid="service-deposit">
      <label className="sr-only" htmlFor={`dep-kind-${serviceId}`}>
        Anticipo
      </label>
      <select
        id={`dep-kind-${serviceId}`}
        value={kind}
        onChange={(e) => setKind(e.target.value as Kind)}
        className="rounded-[10px] border border-line bg-white px-2 py-1.5 text-sm text-ink"
      >
        <option value="none">Sin anticipo</option>
        <option value="fixed">Anticipo fijo</option>
        <option value="percent">Anticipo en %</option>
      </select>
      {kind !== 'none' && (
        <input
          type="number"
          min={1}
          max={kind === 'percent' ? 100 : undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={kind === 'percent' ? 'Porcentaje del precio' : 'Monto del anticipo'}
          placeholder={kind === 'percent' ? '%' : '$'}
          className="w-20 rounded-[10px] border border-line bg-white px-2 py-1.5 text-sm text-ink"
        />
      )}
      {preview && <span className="text-xs text-ink-muted">= {preview}</span>}
      {kind === 'percent' && price == null && <span className="text-xs text-warn">Ponle precio al servicio</span>}
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[10px] bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? '…' : 'Guardar'}
        </button>
      )}
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </span>
  )
}
