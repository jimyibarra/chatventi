'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { CONTROL, CONTROL_H } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'

type Msg = { me: boolean; text: string }

type Service = { name: string; price: number | null }

// Sandbox del dashboard: conversa con el agente REAL de la org (motor de
// producción, escrituras simuladas). Ver /api/agente/probar.
export function ProbarChat({
  businessName,
  agentEnabled,
  services,
}: {
  businessName: string
  agentEnabled: boolean
  services: Service[]
}) {
  const greeting = useMemo(
    () =>
      `¡Hola! 😊 Soy el recepcionista IA de ${businessName}. Escríbeme como si fueras un cliente: pídeme una cita, pregúntame precios u horarios.`,
    [businessName]
  )

  const suggestions = useMemo(() => {
    const out = ['Quiero una cita para mañana']
    const withPrice = services.find((s) => s.price != null)
    if (withPrice) out.push(`¿Cuánto cuesta ${withPrice.name.toLowerCase()}?`)
    out.push('¿Qué servicios ofrecen?')
    out.push('¿Cuál es su horario?')
    return out.slice(0, 4)
  }, [services])

  const [messages, setMessages] = useState<Msg[]>([{ me: false, text: greeting }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [limited, setLimited] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    const value = text.trim()
    if (!value || busy || limited) return
    setInput('')
    setMessages((prev) => [...prev, { me: true, text: value }])
    setBusy(true)
    try {
      const res = await fetch('/api/agente/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      })
      const data = (await res.json().catch(() => null)) as {
        reply?: string
        limited?: boolean
        remaining?: number
      } | null
      const reply =
        data?.reply ?? 'Ups, no pude responder ahora mismo. Intenta de nuevo en un momento 🙏'
      setMessages((prev) => [...prev, { me: false, text: reply }])
      if (data?.limited || data?.remaining === 0) setLimited(true)
    } catch {
      setMessages((prev) => [
        ...prev,
        { me: false, text: 'Ups, no pude responder. Intenta de nuevo en un momento 🙏' },
      ])
    }
    setBusy(false)
  }

  async function reset() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/agente/probar/reset', { method: 'POST' })
    } catch {
      /* no-op: el reinicio local ya deja el chat listo */
    }
    setMessages([{ me: false, text: greeting }])
    setLimited(false)
    setBusy(false)
  }

  return (
    <div className="w-full min-w-0">
      {!agentEnabled && (
        <Notice tone="info" size="sm" className="mx-auto mb-3 max-w-[540px]">
          Tu recepcionista está <b>desactivada</b> para clientes reales, pero aquí puedes probarla con
          total libertad. Actívala cuando estés a gusto con sus respuestas.
        </Notice>
      )}

      {/* Marco tipo teléfono */}
      <div className="mx-auto flex max-w-[540px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_0_#dde2f0,0_18px_40px_-18px_rgba(42,26,94,.35)]">
        {/* Cabecera: la tinta de la recepcionista, como en el Panel */}
        <div className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
          <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-brand-500">
            <Icon name="robot" className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">{businessName}</p>
            <p className="flex items-center gap-1.5 text-[12.5px] text-[#dcd8f7]">
              <i className="h-[7px] w-[7px] rounded-full bg-[#4ade80]" aria-hidden />
              Recepcionista IA · modo prueba
            </p>
          </div>
          <Button variant="inverse" size="sm" onClick={reset} disabled={busy} className="ml-auto">
            <Icon name="refresh" className="h-4 w-4" />
            Reiniciar
          </Button>
        </div>

        {/* Hilo */}
        <div
          ref={scrollRef}
          data-testid="probar-chat-messages"
          className="flex h-[min(58vh,460px)] flex-col gap-2.5 overflow-y-auto bg-[#f6f7fc] p-4"
          aria-live="polite"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`cv-pop max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] ${
                m.me
                  ? 'self-end rounded-[18px_18px_6px_18px] bg-brand-500 text-white'
                  : 'self-start rounded-[18px_18px_18px_6px] bg-white text-ink shadow-[0_1px_0_#dde2f0]'
              }`}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div
              className="inline-flex gap-1.5 self-start rounded-[18px_18px_18px_6px] bg-white px-4 py-3.5 shadow-[0_1px_0_#dde2f0]"
              aria-label="La IA está escribiendo"
              role="status"
            >
              <span className="cv-dot" />
              <span className="cv-dot" />
              <span className="cv-dot" />
            </div>
          )}
        </div>

        {/* Sugerencias (solo al inicio) */}
        {messages.length <= 1 && !busy && (
          <div className="flex flex-wrap gap-2 bg-[#f6f7fc] px-4 pb-3">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-[44px] rounded-full bg-white md:min-h-[40px] px-3.5 text-[13.5px] font-semibold text-brand-700 shadow-[inset_0_0_0_2px_#c4bff5] transition-colors duration-150 hover:bg-brand-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Entrada */}
        <div className="flex items-center gap-2 border-t border-line bg-white p-3">
          {limited ? (
            <Button onClick={reset} className="w-full">
              <Icon name="refresh" />
              Reiniciar conversación
            </Button>
          ) : (
            <>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Tu mensaje de prueba</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') send(input)
                  }}
                  placeholder="Escribe como un cliente…"
                  data-testid="probar-chat-input"
                  className={`${CONTROL} ${CONTROL_H} w-full`}
                />
              </label>
              <Button onClick={() => send(input)} disabled={busy || !input.trim()} data-testid="probar-chat-send">
                <Icon name="send" />
                Enviar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
