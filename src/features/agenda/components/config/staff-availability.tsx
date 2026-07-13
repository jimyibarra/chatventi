'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addStaffSchedule, deleteStaffSchedule } from '../../actions'
import { WEEKDAYS, type StaffSchedule, type Profile } from '../../types'

export function StaffAvailability({
  branchId,
  staff,
  schedules,
}: {
  branchId: string
  staff: Profile[]
  schedules: StaffSchedule[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '')
  const [weekday, setWeekday] = useState('1')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [error, setError] = useState<string | null>(null)

  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? 'Sin nombre'

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await addStaffSchedule({
        branchId,
        staffId,
        weekday,
        startTime: start,
        endTime: end,
      })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteStaffSchedule(id)
      router.refresh()
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-ink">Disponibilidad del equipo</h2>

      {staff.length === 0 ? (
        <p className="text-sm text-warn">No hay miembros del equipo activos.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-ink-soft">Profesional</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                data-testid="avail-staff"
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? 'Sin nombre'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-soft">Día</label>
              <select
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
                data-testid="avail-weekday"
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                {WEEKDAYS.map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <span className="text-ink-faint">–</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <button
              onClick={add}
              disabled={pending || !staffId}
              data-testid="add-availability"
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>

          {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

          <ul className="divide-y divide-line-row">
            {schedules.length === 0 && (
              <li className="py-2 text-sm text-ink-faint">Sin bloques de disponibilidad.</li>
            )}
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-muted">
                  {staffName(s.staff_id)} · {WEEKDAYS[s.weekday]} {s.start_time.slice(0, 5)}–
                  {s.end_time.slice(0, 5)}
                </span>
                <button
                  onClick={() => remove(s.id)}
                  disabled={pending}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
