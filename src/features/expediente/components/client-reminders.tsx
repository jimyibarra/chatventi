'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addClientReminder,
  deleteClientReminder,
  setClientReminderActive,
} from '../actions'
import { REMINDER_PRESETS, type ClientReminder } from '../types'
import { Inset, Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Textarea } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip } from '@/shared/components/ui/status-chip'

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
    <Section
      title="Recordatorios recurrentes"
      description="Invita al cliente a volver cada cierto tiempo. Se envía solo, por el chat donde te escribe."
      actions={
        <Button
          variant={open ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          data-testid="reminder-toggle"
          aria-expanded={open}
        >
          {open ? 'Cerrar' : (
            <>
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
              Agregar
            </>
          )}
        </Button>
      }
    >
      {!canReach && (
        <Notice tone="info" size="sm" className="mb-4">
          Este cliente todavía no tiene una conversación por WhatsApp o Telegram, así que no hay por
          dónde enviarle el recordatorio. Se guardará y saldrá en cuanto te escriba.
        </Notice>
      )}

      {open && (
        <Inset className="mb-4 space-y-3">
          <Field label="Mensaje">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Hola, ya va siendo hora de tu corte. ¿Te agendo esta semana?"
              data-testid="reminder-message"
            />
          </Field>
          <Field label="Cada cuánto" as="div">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cada cuánto">
              {REMINDER_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => pickPreset(p.days)}
                  aria-pressed={days === p.days}
                  className={`min-h-[44px] rounded-full px-3.5 text-[13.5px] font-semibold transition-colors duration-150 md:min-h-[36px] ${
                    days === p.days ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_2px_#d6dbec] hover:bg-brand-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Primer envío" className="max-w-[14rem]">
            <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} data-testid="reminder-first" />
          </Field>
          <Button onClick={add} disabled={pending || !message.trim()} data-testid="reminder-save">
            {pending ? 'Guardando…' : 'Guardar recordatorio'}
          </Button>
        </Inset>
      )}

      {error && <p className="mb-3 text-sm text-[#a51b18]" role="alert">{error}</p>}

      {reminders.length === 0 ? (
        <p className="text-[14.5px] text-ink-muted">Sin recordatorios.</p>
      ) : (
        <ul className="divide-y divide-line">
          {reminders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 basis-[14rem]">
                <p className={`text-[15px] leading-snug ${r.active ? 'text-ink' : 'text-ink-muted line-through'}`}>{r.message}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
                  <StatusChip tone={r.active ? 'ok' : 'off'}>{r.active ? 'Activo' : 'Pausado'}</StatusChip>
                  <span>Cada {r.interval_days} días</span>
                  <span>· Próximo: {dateLabel(r.next_due_at)}</span>
                  {r.last_sent_at && <span>· Último: {dateLabel(r.last_sent_at)}</span>}
                </p>
              </div>
              <div className="ml-auto flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggle(r.id, !r.active)}
                  disabled={pending}
                  data-testid="reminder-toggle-active"
                >
                  <Icon name={r.active ? 'pause' : 'play'} className="h-4 w-4" />
                  {r.active ? 'Pausar' : 'Reanudar'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(r.id)} disabled={pending} aria-label="Eliminar recordatorio">
                  <Icon name="trash" className="h-4 w-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
