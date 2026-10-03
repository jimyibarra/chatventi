'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  INCLUDED_CAPABILITIES,
  TOGGLEABLE_CAPABILITIES,
  type CapColumn,
} from '../capabilities'
import { saveCapabilities, saveReminder2h } from '../actions'
import { Section, SubHeading } from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/field'
import { Icon, type IconName } from '@/shared/components/ui/icon'
import { StatusChip } from '@/shared/components/ui/status-chip'

// Un icono dibujado por capacidad (en vez de emojis).
const CAP_ICON: Record<string, IconName> = {
  agenda: 'calendar',
  escalamiento: 'user',
  aprobacion: 'check',
  'memoria-cliente': 'users',
  conocimiento: 'book',
  recordatorios: 'bell',
  botones: 'chat',
  'voz-de-marca': 'sparkle',
  vision: 'eye',
  transcribe: 'mic',
  scoring: 'star',
  csat: 'chat',
  'cold-followup': 'repeat',
  'daily-report': 'file',
}

function CapRow({
  icon,
  name,
  description,
  extra,
  control,
  on,
}: {
  icon: IconName
  name: string
  description: string
  extra?: React.ReactNode
  control: React.ReactNode
  on: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        className={`grid h-9 w-9 flex-none place-items-center rounded-[11px] transition-colors duration-200 ${
          on ? 'bg-brand-500 text-white' : 'bg-surface text-ink-muted'
        }`}
        aria-hidden
      >
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-ink">{name}</span>
        <span className="mt-0.5 block max-w-[62ch] text-[13.5px] leading-snug text-ink-muted">{description}</span>
        {extra}
      </span>
      <span className="pt-1">{control}</span>
    </label>
  )
}

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

  const onCount = TOGGLEABLE_CAPABILITIES.filter((c) => caps[c.column]).length

  return (
    <Section
      title="Lo que sabe hacer tu recepcionista"
      description="Lo básico ya viene incluido. Los superpoderes se encienden cuando tú quieras."
    >
      {/* Incluidas: se nombran, no se apagan. */}
      <SubHeading>Incluido siempre</SubHeading>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {INCLUDED_CAPABILITIES.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[#d6f5e3] text-[#0b5d36]" aria-hidden>
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold leading-snug text-ink">{c.name}</span>
              <span className="block text-[13px] leading-snug text-ink-muted">{c.description}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SubHeading className="mb-0">Superpoderes</SubHeading>
        <span className="text-[13px] font-semibold tabular-nums text-ink-muted">
          {onCount} de {TOGGLEABLE_CAPABILITIES.length} encendidos
        </span>
      </div>
      <p className="mb-3 mt-1 max-w-[65ch] text-[13.5px] leading-snug text-ink-muted">
        Vienen apagados. Enciéndelos de uno en uno y pruébalos en el chat de prueba antes de que
        atiendan a un cliente.
      </p>

      <div className="divide-y divide-line">
        {TOGGLEABLE_CAPABILITIES.map((c) => (
          <CapRow
            key={c.id}
            icon={CAP_ICON[c.id] ?? 'sparkle'}
            name={c.name}
            description={c.description}
            on={caps[c.column]}
            extra={
              <>
                {c.consumesAi && (
                  <StatusChip tone="neutral" className="mt-1.5" icon={<Icon name="sparkle" className="h-3 w-3" strokeWidth={2.4} />}>
                    Consume IA
                  </StatusChip>
                )}
                {unavailable[c.column] && (
                  <span className="mt-1.5 block text-[13px] font-semibold text-[#8a5a00]">{unavailable[c.column]}</span>
                )}
              </>
            }
            control={
              <Switch
                checked={caps[c.column]}
                disabled={pending || Boolean(unavailable[c.column])}
                onChange={() => toggle(c.column)}
                data-testid={`cap-${c.id}`}
                aria-label={c.name}
              />
            }
          />
        ))}
      </div>

      <SubHeading className="mb-1 mt-7">Recordatorios</SubHeading>
      <p className="mb-3 max-w-[65ch] text-[13.5px] leading-snug text-ink-muted">
        El aviso de 24 h antes siempre se envía. El de 2 h es opcional: cada mensaje de
        WhatsApp tendrá costo a partir de octubre de 2026.
      </p>
      <CapRow
        icon="clock"
        name="Recordatorio de 2 h antes de la cita"
        description="Un segundo aviso el mismo día. Apágalo si con el de 24 h te basta: es un mensaje menos por cada cita."
        on={rem2h}
        control={
          <Switch
            checked={rem2h}
            disabled={pending}
            onChange={toggleReminder2h}
            data-testid="reminder-2h"
            aria-label="Recordatorio de 2 h antes de la cita"
          />
        }
      />

      {msg && !msg.ok && <p className="mt-4 text-sm text-[#a51b18]" role="alert">{msg.text}</p>}
    </Section>
  )
}
