'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setOrderEta, setOrderStatus } from '../actions'
import { nextStatuses, type OrderStatus } from '../parse'
import { Button } from '@/shared/components/ui/button'
import { CONTROL, CONTROL_H } from '@/shared/components/ui/field'

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: 'Empezar a preparar',
  ready: 'Listo · avisar al cliente',
  delivered: 'Entregado',
}

/** Botones de un pedido: avanza al siguiente estado; cancelar pide confirmación. */
export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ tone: 'error' | 'warn'; text: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const options = nextStatuses(status)

  function go(next: OrderStatus) {
    setMsg(null)
    start(async () => {
      const res = await setOrderStatus(orderId, next)
      if (!res.ok) setMsg({ tone: 'error', text: res.error })
      else if (res.warning) setMsg({ tone: 'warn', text: res.warning })
      setConfirmCancel(false)
      router.refresh()
    })
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {options
          .filter((s) => s !== 'cancelled')
          .map((s, i) => (
            <Button key={s} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => go(s)} disabled={pending} data-testid={`order-${s}`}>
              {ACTION_LABEL[s]}
            </Button>
          ))}
        {options.includes('cancelled') && !confirmCancel && (
          <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)} disabled={pending}>
            Cancelar
          </Button>
        )}
        {confirmCancel && (
          <>
            <Button size="sm" variant="danger" onClick={() => go('cancelled')} disabled={pending} data-testid="order-cancel-confirm">
              Sí, cancelar pedido
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)} disabled={pending}>
              No
            </Button>
          </>
        )}
      </div>
      {msg && (
        <p role="status" className={`rounded-[10px] px-2.5 py-1.5 text-[13px] leading-snug ${msg.tone === 'error' ? 'bg-[#fde3e1] text-[#8f1714]' : 'bg-[#fff2cf] text-ink'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

/** Tiempo estimado que la recepcionista promete al confirmar (dueño o gerente). */
export function EtaForm({ minutes }: { minutes: number }) {
  const router = useRouter()
  const [value, setValue] = useState(String(minutes))
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function save() {
    setMsg(null)
    start(async () => {
      const res = await setOrderEta(Number(value))
      setMsg(res.ok ? 'Guardado.' : res.error)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[14px] text-ink-muted">
      <label htmlFor="order-eta">Tiempo estimado que prometemos:</label>
      <input
        id="order-eta"
        type="number"
        min={5}
        max={240}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`${CONTROL} ${CONTROL_H} w-24 tabular-nums`}
      />
      <span>min</span>
      <Button size="sm" variant="secondary" onClick={save} disabled={pending || value === String(minutes)}>
        Guardar
      </Button>
      {msg && <span role="status">{msg}</span>}
    </div>
  )
}

/** Los pedidos llegan solos: la pantalla se actualiza cada 30 s. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
