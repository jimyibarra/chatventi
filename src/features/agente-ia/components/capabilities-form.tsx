'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  INCLUDED_CAPABILITIES,
  TOGGLEABLE_CAPABILITIES,
  type CapColumn,
} from '../capabilities'
import { saveCapabilities, saveReminder2h } from '../actions'

export function CapabilitiesForm({
  state,
  // Capacidades que no se pueden encender todavía porque les falta algo del
  // lado del servidor (hoy: la transcripción necesita su propia API key).
  // Encenderlas sin eso no rompe nada —el sistema degrada al aviso de
  // siempre— pero el dueño creería que ya escucha los audios.
  unavailable = {},
  reminder2h = true,
}: {
  state: Record<CapColumn, boolean>
  unavailable?: Partial<Record<CapColumn, string>>
  reminder2h?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [caps, setCaps] = useState(state)
  const [rem2h, setRem2h] = useState(reminder2h)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function toggleReminder2h() {
    const next = !rem2h
    setRem2h(next)
    setMsg(null)
    startTransition(async () => {
      const res = await saveReminder2h(next)
      if (res.ok) {
        router.refresh()
      } else {
        setRem2h(!next) // revierte si el guardado falló
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  function toggle(col: CapColumn) {
    const next = { ...caps, [col]: !caps[col] }
    setCaps(next)
    setMsg(null)
    startTransition(async () => {
      const res = await saveCapabilities(next)
      if (res.ok) {
        router.refresh()
      } else {
        setCaps(caps) // revierte el interruptor si el guardado falló
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-ink">Lo que sabe hacer tu recepcionista</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Todo lo de abajo ya viene incluido. Los superpoderes se encienden cuando tú quieras.
      </p>

      {/* Incluidas: se nombran, no se apagan. */}
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {INCLUDED_CAPABILITIES.map((c) => (
          <li key={c.id} className="rounded-lg border border-line bg-surface p-3">
            <p className="text-sm font-medium text-ink">
              <span aria-hidden className="mr-1.5">{c.emoji}</span>
              {c.name}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.description}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-7 text-sm font-semibold text-ink">Superpoderes</h3>
      <p className="mt-1 text-xs text-ink-faint">
        Vienen apagados. Enciéndelos de uno en uno y pruébalos en el chat de prueba antes de
        que atiendan a un cliente.
      </p>

      <ul className="mt-3 space-y-2">
        {TOGGLEABLE_CAPABILITIES.map((c) => (
          <li
            key={c.id}
            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
              caps[c.column] ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface'
            }`}
          >
            <input
              type="checkbox"
              checked={caps[c.column]}
              disabled={pending || Boolean(unavailable[c.column])}
              onChange={() => toggle(c.column)}
              data-testid={`cap-${c.id}`}
              className="mt-1 h-4 w-4 shrink-0 rounded border-line text-brand-500 focus:ring-brand-400"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                <span aria-hidden className="mr-1.5">{c.emoji}</span>
                {c.name}
                {c.consumesAi && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                    consume IA
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.description}</p>
              {unavailable[c.column] && (
                <p className="mt-1.5 text-xs font-medium text-amber-800">
                  {unavailable[c.column]}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-7 text-sm font-semibold text-ink">Recordatorios</h3>
      <p className="mt-1 text-xs text-ink-faint">
        El aviso de 24 h antes siempre se envía. El de 2 h es opcional: cada mensaje de
        WhatsApp tendrá costo a partir de octubre de 2026.
      </p>
      <div className="mt-3 flex items-start gap-3 rounded-lg border border-line bg-surface p-3">
        <input
          type="checkbox"
          checked={rem2h}
          disabled={pending}
          onChange={toggleReminder2h}
          data-testid="reminder-2h"
          className="mt-1 h-4 w-4 shrink-0 rounded border-line text-brand-500 focus:ring-brand-400"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            <span aria-hidden className="mr-1.5">⏰</span>
            Recordatorio de 2 h antes de la cita
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Un segundo aviso el mismo día. Apágalo si con el de 24 h te basta: es un
            mensaje menos por cada cita.
          </p>
        </div>
      </div>

      {msg && !msg.ok && <p className="mt-4 text-sm text-red-600">{msg.text}</p>}
    </section>
  )
}
