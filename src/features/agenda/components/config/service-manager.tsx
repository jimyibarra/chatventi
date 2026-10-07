'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveService, deleteService } from '../../actions'
import type { ServiceCatalog } from '../../types'
import { ServiceDepositControl } from '@/features/anticipos/components/service-deposit-control'
import { CARD_SHADOW, buttonClass, CONTROL, CONTROL_H, FIELD_LABEL } from '@/shared/components/ui'

export function ServiceManager({ services, lockedBy = null }: { services: ServiceCatalog[]; lockedBy?: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await saveService({
        name,
        durationMinutes: duration,
        price: price === '' ? null : price,
        active: true,
      })
      if (res.ok) {
        setName('')
        setDuration('30')
        setPrice('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteService(id)
      router.refresh()
    })
  }

  return (
    <section className={`rounded-card bg-white p-4 md:p-5 ${CARD_SHADOW}`}>
      <h2 className="mb-3.5 text-[1.15rem] font-bold leading-tight text-ink">Servicios</h2>

      {lockedBy ? (
        <p className="mb-4 rounded-[14px] bg-[#fff4d6] px-3.5 py-3 text-[14.5px] text-ink" data-testid="catalog-locked">
          Tus servicios y tu horario se editan en tu panel de {lockedBy}.
        </p>
      ) : (
      <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-[16px] bg-surface p-3.5">
        <div className="min-w-[min(100%,12rem)] flex-1">
          <label className={FIELD_LABEL}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="service-name"
            className={`${CONTROL} ${CONTROL_H} w-full`}
            placeholder="Corte de cabello"
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Duración (min)</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            data-testid="service-duration"
            className={`${CONTROL} ${CONTROL_H} w-28 tabular-nums`}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Precio</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${CONTROL} ${CONTROL_H} w-28 tabular-nums`}
            placeholder="—"
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !name}
          data-testid="add-service"
          className={buttonClass('primary')}
        >
          Agregar
        </button>
      </div>
      )}

      {error && <p className="mb-2 text-sm text-[#a51b18]">{error}</p>}

      <ul className="divide-y divide-line">
        {services.length === 0 && (
          <li className="py-2 text-[14.5px] text-ink-muted">Aún no hay servicios.</li>
        )}
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 text-[15px] tabular-nums first:pt-1 last:pb-0">
            <span className={`min-w-0 flex-1 basis-[13rem] ${s.active ? 'font-semibold text-ink' : 'text-ink-muted line-through'}`}>
              {s.name} · {s.duration_minutes}m
              {s.price_text ? ` · ${s.price_text}` : s.price != null ? ` · $${Number(s.price).toLocaleString('en-US')}` : ''}
              {!s.active && ' (inactivo)'}
            </span>
            {s.active && (
              <ServiceDepositControl serviceId={s.id} type={s.deposit_type} value={s.deposit_value} price={s.price} />
            )}
            {s.active && !lockedBy && (
              <button
                onClick={() => remove(s.id)}
                disabled={pending}
                className={buttonClass('danger', 'sm')}
              >
                Desactivar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
