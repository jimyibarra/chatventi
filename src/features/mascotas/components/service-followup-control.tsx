'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveServiceFollowup } from '../actions'
import { Button, CONTROL } from '@/shared/components/ui'

/**
 * «Recordar volver en N días» de un servicio (fase 3). Al terminar la cita, la
 * corrida diaria deja un recordatorio de una sola vez; si el cliente ya agendó,
 * no se manda.
 */
export function ServiceFollowupControl({ serviceId, days }: { serviceId: string; days: number | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [value, setValue] = useState(days != null ? String(days) : '')
  const [error, setError] = useState('')
  const dirty = value !== (days != null ? String(days) : '')

  function save() {
    setError('')
    start(async () => {
      const res = await saveServiceFollowup({ serviceId, days: value.trim() === '' ? null : value })
      if (!res.ok) return setError(res.error)
      router.refresh()
    })
  }

  return (
    <span className="flex flex-wrap items-center gap-2 font-normal" data-testid="service-followup">
      <label htmlFor={`fu-${serviceId}`} className="text-[13px] text-ink-muted">
        Recordar volver en
      </label>
      <input
        id={`fu-${serviceId}`}
        type="number"
        min={1}
        max={3650}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="—"
        className={`${CONTROL} min-h-[44px] w-20 text-sm tabular-nums md:min-h-[36px]`}
      />
      <span className="text-[13px] text-ink-muted">días</span>
      {dirty && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      )}
      {error && <span className="text-[13px] text-[#a51b18]">{error}</span>}
    </span>
  )
}
