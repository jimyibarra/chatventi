'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveBusinessHour } from '../../actions'
import { WEEKDAYS, type BusinessHour } from '../../types'
import { CARD_SHADOW, buttonClass, CHECKBOX, CONTROL, CONTROL_H } from '@/shared/components/ui'

export function HoursManager({
  branchId,
  hours,
  lockedBy = null,
}: {
  branchId: string
  hours: BusinessHour[]
  /** Nombre del socio que administra el horario: se muestra sin editar. */
  lockedBy?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const byDay = new Map(hours.map((h) => [h.weekday, h]))

  function save(weekday: number, open: string, close: string, closed: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await saveBusinessHour({
        branchId,
        weekday,
        openTime: open,
        closeTime: close,
        isClosed: closed,
      })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <section className={`rounded-card bg-white p-4 md:p-5 ${CARD_SHADOW}`}>
      <h2 className="mb-3 text-[1.15rem] font-bold leading-tight text-ink">Horario de la sucursal</h2>
      {error && <p className="mb-2 text-sm text-[#a51b18]">{error}</p>}
      {lockedBy && (
        <p className="mb-3 rounded-[14px] bg-[#fff4d6] px-3.5 py-3 text-[14.5px] text-ink">
          Tu horario se edita en tu panel de {lockedBy}.
        </p>
      )}
      <div className="divide-y divide-line">
        {WEEKDAYS.map((label, weekday) => {
          const h = byDay.get(weekday)
          if (lockedBy) {
            const closed = h?.is_closed ?? h === undefined
            return (
              <div key={weekday} className="flex items-center gap-3 py-2.5 text-[15px] first:pt-0 last:pb-0 tabular-nums" data-testid={`hour-row-${weekday}`}>
                <span className={`w-24 font-semibold ${closed ? 'text-ink-muted' : 'text-ink'}`}>{label}</span>
                <span className="text-ink-muted">{closed ? 'Cerrado' : `${h?.open_time?.slice(0, 5)} – ${h?.close_time?.slice(0, 5)}`}</span>
              </div>
            )
          }
          return (
            <HourRow
              key={weekday}
              label={label}
              weekday={weekday}
              open={h?.open_time?.slice(0, 5) ?? '09:00'}
              close={h?.close_time?.slice(0, 5) ?? '18:00'}
              closed={h?.is_closed ?? h === undefined}
              disabled={pending}
              onSave={save}
            />
          )
        })}
      </div>
    </section>
  )
}

function HourRow({
  label,
  weekday,
  open,
  close,
  closed,
  disabled,
  onSave,
}: {
  label: string
  weekday: number
  open: string
  close: string
  closed: boolean
  disabled: boolean
  onSave: (weekday: number, open: string, close: string, closed: boolean) => void
}) {
  const [o, setO] = useState(open)
  const [c, setC] = useState(close)
  const [isClosed, setIsClosed] = useState(closed)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 py-2.5 text-[15px] first:pt-0 last:pb-0" data-testid={`hour-row-${weekday}`}>
      <span className={`w-24 font-semibold ${isClosed ? 'text-ink-muted' : 'text-ink'}`}>{label}</span>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-[13.5px] text-ink-muted md:min-h-[40px]">
        <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} className={CHECKBOX} />
        Cerrado
      </label>
      {/* Celular: las horas bajan a su propia fila; día, «Cerrado» y Guardar quedan arriba. */}
      <span className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
        <input
          type="time"
          value={o}
          disabled={isClosed}
          onChange={(e) => setO(e.target.value)}
          aria-label={`${label}: abre`}
          className={`${CONTROL} ${CONTROL_H} w-[9.25rem] tabular-nums sm:w-[10rem]`}
        />
        <span className="text-ink-muted" aria-hidden>–</span>
        <input
          type="time"
          value={c}
          disabled={isClosed}
          onChange={(e) => setC(e.target.value)}
          aria-label={`${label}: cierra`}
          className={`${CONTROL} ${CONTROL_H} w-[9.25rem] tabular-nums sm:w-[10rem]`}
        />
      </span>
      <button
        onClick={() => onSave(weekday, o, c, isClosed)}
        disabled={disabled}
        className={`${buttonClass('secondary', 'sm')} ml-auto`}
      >
        Guardar
      </button>
    </div>
  )
}
