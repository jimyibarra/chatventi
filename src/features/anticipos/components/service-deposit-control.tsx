'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveServiceDeposit } from '../actions'
import { money } from '../labels'
import { Button, CONTROL, Select } from '@/shared/components/ui'

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
    <span className="flex flex-wrap items-center gap-2 font-normal" data-testid="service-deposit">
      <label className="sr-only" htmlFor={`dep-kind-${serviceId}`}>
        Anticipo
      </label>
      <Select
        id={`dep-kind-${serviceId}`}
        value={kind}
        onChange={(e) => setKind(e.target.value as Kind)}
        className="text-sm"
        wrapperClassName="w-[11.5rem]"
      >
        <option value="none">Sin anticipo</option>
        <option value="fixed">Anticipo fijo</option>
        <option value="percent">Anticipo en %</option>
      </Select>
      {kind !== 'none' && (
        <input
          type="number"
          min={1}
          max={kind === 'percent' ? 100 : undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={kind === 'percent' ? 'Porcentaje del precio' : 'Monto del anticipo'}
          placeholder={kind === 'percent' ? '%' : '$'}
          className={`${CONTROL} min-h-[44px] w-20 text-sm tabular-nums md:min-h-[36px]`}
        />
      )}
      {preview && <span className="text-[13px] tabular-nums text-ink-muted">= {preview}</span>}
      {kind === 'percent' && price == null && <span className="text-[13px] text-[#8a5a00]">Ponle precio al servicio</span>}
      {dirty && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
      {error && <span className="w-full text-[13px] text-[#a51b18]">{error}</span>}
    </span>
  )
}
