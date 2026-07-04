'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveBusinessHour } from '../../actions'
import { WEEKDAYS, type BusinessHour } from '../../types'

export function HoursManager({
  branchId,
  hours,
}: {
  branchId: string
  hours: BusinessHour[]
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Horario de la sucursal</h2>
      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-1">
        {WEEKDAYS.map((label, weekday) => {
          const h = byDay.get(weekday)
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
    <div className="flex flex-wrap items-center gap-2 py-1 text-sm" data-testid={`hour-row-${weekday}`}>
      <span className="w-24 text-gray-700">{label}</span>
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
        Cerrado
      </label>
      <input
        type="time"
        value={o}
        disabled={isClosed}
        onChange={(e) => setO(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
      />
      <span className="text-gray-400">–</span>
      <input
        type="time"
        value={c}
        disabled={isClosed}
        onChange={(e) => setC(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
      />
      <button
        onClick={() => onSave(weekday, o, c, isClosed)}
        disabled={disabled}
        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Guardar
      </button>
    </div>
  )
}
