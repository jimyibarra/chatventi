'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'

export type WhatsAppRow = {
  id: string
  name: string | null
  phone: string | null
  mode: 'coexistence' | 'cloud_api' | null
  externalId: string
  wabaId: string | null
  status: { tone: ChipTone; label: string }
  disabled: boolean
  disconnectedByOwner: boolean
}

const MODE: Record<'coexistence' | 'cloud_api', { tone: ChipTone; label: string; help: string }> = {
  coexistence: { tone: 'brand', label: 'Coexistencia', help: 'El número sigue en tu app WhatsApp Business y la recepcionista contesta desde aquí.' },
  cloud_api: { tone: 'neutral', label: 'Número completo', help: 'El número vive solo aquí (API de WhatsApp); ya no se usa en la app del celular.' },
}

/** Cómo soltar el número del todo después de desconectarlo aquí. */
function afterDisconnect(mode: WhatsAppRow['mode']): string {
  return mode === 'coexistence'
    ? 'Tu número sigue funcionando en tu app WhatsApp Business. Si además quieres quitar la conexión en la app, entra en ella a Ajustes → Cuenta → «Business Platform» (o «Plataforma empresarial») → Desconectar. Para volver a conectarlo aquí usa «Conectar el número que ya uso en WhatsApp Business».'
    : 'El número sigue en tu cuenta de WhatsApp en Meta. Para volver a usarlo en la app del celular, bórralo en WhatsApp Manager (business.facebook.com → WhatsApp Manager → Números de teléfono). Para volver a conectarlo aquí usa «Conectar WhatsApp».'
}

export function WhatsAppChannels({ rows, canManage }: { rows: WhatsAppRow[]; canManage: boolean }) {
  const [showTech, setShowTech] = useState(false)
  if (rows.length === 0) {
    return (
      <p className="mb-4 flex items-center gap-2.5 rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted">
        <i className="h-2.5 w-2.5 flex-none rounded-full border-2 border-ink-faint" aria-hidden />
        Todavía no has conectado ningún WhatsApp.
      </p>
    )
  }
  return (
    <div className="mb-4">
      <ul className="space-y-2" data-testid="wa-channels">
        {rows.map((ch) => (
          <ChannelItem key={ch.id} ch={ch} showTech={showTech} canManage={canManage} />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setShowTech((v) => !v)}
        aria-expanded={showTech}
        className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-[11px] px-2 text-[13px] font-semibold text-ink-muted hover:bg-brand-50 hover:text-ink"
        data-testid="wa-tech-toggle"
      >
        <Icon name={showTech ? 'eyeOff' : 'eye'} className="h-4 w-4" />
        {showTech ? 'Ocultar datos técnicos' : 'Ver datos técnicos (ID y WABA)'}
      </button>
    </div>
  )
}

function ChannelItem({ ch, showTech, canManage }: { ch: WhatsAppRow; showTech: boolean; canManage: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const mode = ch.mode ? MODE[ch.mode] : null
  const title = ch.name ?? ch.phone ?? 'WhatsApp'

  function disconnect() {
    setError(null)
    start(async () => {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channelId: ch.id }),
      }).catch(() => null)
      if (!res?.ok) {
        setError('No se pudo desconectar. Intenta de nuevo en un momento.')
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <li className="rounded-[14px] bg-surface px-3.5 py-3" data-testid="wa-channel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-white text-ink shadow-[0_1px_0_#dde2f0]" aria-hidden>
          <Icon name="whatsapp" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 basis-[12rem]">
          <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-muted">
            {ch.phone && <span className="tabular-nums">{ch.phone}</span>}
            {mode && (
              <span title={mode.help}>
                <StatusChip tone={mode.tone}>{mode.label}</StatusChip>
              </span>
            )}
          </p>
          {showTech && (
            <p className="mt-1 text-[12.5px] tabular-nums text-ink-muted [overflow-wrap:anywhere]" data-testid="wa-tech">
              ID: {ch.externalId}
              {ch.wabaId ? ` · WABA ${ch.wabaId}` : ''}
            </p>
          )}
        </div>
        <StatusChip tone={ch.status.tone}>{ch.status.label}</StatusChip>
      </div>

      {mode && !ch.disabled && <p className="mt-2 text-[13px] leading-snug text-ink-muted">{mode.help}</p>}

      {ch.disabled && ch.disconnectedByOwner && (
        <p className="mt-2 max-w-[65ch] text-[13px] leading-snug text-ink-muted">Desconectaste este número. {afterDisconnect(ch.mode)}</p>
      )}

      {canManage && !ch.disabled && !confirming && (
        <Button size="sm" variant="danger" className="mt-2" onClick={() => setConfirming(true)} data-testid="wa-disconnect">
          Desconectar este número
        </Button>
      )}

      {confirming && (
        <div className="mt-3 rounded-[12px] bg-[#fde3e1] p-3 text-[14px] text-[#8f1714]" role="alert">
          <p className="font-semibold">¿Desconectar {title}?</p>
          <p className="mt-1 leading-snug">
            La recepcionista deja de contestar por este número y no salen recordatorios por WhatsApp. Tus chats y citas se quedan. Puedes volver a conectarlo cuando quieras.
          </p>
          {error && <p className="mt-2 font-semibold">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              data-testid="wa-disconnect-confirm"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[13px] bg-[#c5221f] px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#a51b18] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[36px]"
            >
              {pending ? 'Desconectando…' : 'Sí, desconectar'}
            </button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
