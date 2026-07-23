'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addClientReminder,
  deleteClientReminder,
  setClientReminderActive,
} from '../actions'
import { REMINDER_PRESETS, type ClientReminder } from '../types'

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(iso))
}

function inDaysValue(days: number): string {
  const d = new Date(Date.now() + days * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Recordatorios recurrentes: "vuelve a cortarte en 3 semanas", "limpieza dental
 * cada 6 meses". El cron diario los envía por el canal donde el cliente escribe
 * y adelanta la próxima fecha, así que no hay que tocar nada después.
 */
export function ClientReminders({
  clientId,
  reminders,
  canReach,
}: {
  clientId: string
  reminders: ClientReminder[]
  canReach: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [days, setDays] = useState(30)
  const [firstDate, setFirstDate] = useState(inDaysValue(30))
  const [error, setError] = useState<string | null>(null)

  function pickPreset(d: number) {
    setDays(d)
    setFirstDate(inDaysValue(d))
  }

  function add() {
    setError(null)
    startTransition(async () => {
      // Se envía a media mañana hora local: un recordatorio a las 3 AM molesta.
      const first = new Date(`${firstDate}T10:00:00`)
      const res = await addClientReminder({
        clientId,
        message,
        intervalDays: days,
        firstDueAt: first.toISOString(),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMessage('')
      setOpen(false)
      router.refresh()
    })
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await setClientReminderActive(id, clientId, active)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteClientReminder(id, clientId)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Recordatorios recurrentes</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid="reminder-toggle"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface"
        >
          {open ? 'Cerrar' : '+ Agregar'}
        </button>
      </div>
      <p className="mb-3 text-sm text-ink-faint">
        Invita al cliente a volver cada cierto tiempo. Se envía solo, por el chat donde te escribe.
      </p>

      {!canReach && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este cliente todavía no tiene una conversación por WhatsApp o Telegram, así que no hay
          por dónde enviarle el recordatorio. Se guardará y saldrá en cuanto te escriba.
        </p>
      )}

      {open && (
        <div className="mb-4 space-y-2 rounded-xl border border-line bg-surface p-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Hola, ya va siendo hora de tu corte. ¿Te agendo esta semana?"
            data-testid="reminder-message"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Cada cuánto</label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => pickPreset(p.days)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    days === p.days
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line text-ink-muted hover:bg-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Primer envío
            </label>
            <input
              type="date"
              value={firstDate}
              onChange={(e) => setFirstDate(e.target.value)}
              data-testid="reminder-first"
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={pending || !message.trim()}
            data-testid="reminder-save"
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      {reminders.length === 0 ? (
        <p className="text-sm text-ink-faint">Sin recordatorios.</p>
      ) : (
        <ul className="divide-y divide-line-row">
          {reminders.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className={`text-ink ${r.active ? '' : 'line-through opacity-60'}`}>
                  {r.message}
                </p>
                <p className="text-xs text-ink-faint">
                  Cada {r.interval_days} días · Próximo: {dateLabel(r.next_due_at)}
                  {r.last_sent_at ? ` · Último: ${dateLabel(r.last_sent_at)}` : ''}
                  {r.active ? '' : ' · Pausado'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => toggle(r.id, !r.active)}
                  disabled={pending}
                  data-testid="reminder-toggle-active"
                  className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface disabled:opacity-50"
                >
                  {r.active ? 'Pausar' : 'Reanudar'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={pending}
                  className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-rose-600 hover:bg-surface disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
