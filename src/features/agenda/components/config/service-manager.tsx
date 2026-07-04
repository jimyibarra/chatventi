'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveService, deleteService } from '../../actions'
import type { ServiceCatalog } from '../../types'

export function ServiceManager({ services }: { services: ServiceCatalog[] }) {
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Servicios</h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="service-name"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Corte de cabello"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Duración (min)</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            data-testid="service-duration"
            className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Precio</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="—"
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !name}
          data-testid="add-service"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      <ul className="divide-y divide-gray-100">
        {services.length === 0 && (
          <li className="py-2 text-sm text-gray-400">Aún no hay servicios.</li>
        )}
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span className={s.active ? 'text-gray-800' : 'text-gray-400 line-through'}>
              {s.name} · {s.duration_minutes}m
              {s.price != null ? ` · $${s.price}` : ''}
              {!s.active && ' (inactivo)'}
            </span>
            {s.active && (
              <button
                onClick={() => remove(s.id)}
                disabled={pending}
                className="text-xs text-rose-600 hover:underline"
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
