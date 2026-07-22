'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
    <div className="w-full">
      {!agentEnabled && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Tu recepcionista está <b>desactivado</b> para clientes reales, pero aquí puedes
          probarlo con total libertad. Actívalo cuando estés a gusto con sus respuestas.
        </div>
      )}

      {/* Marco tipo teléfono */}
      <div className="mx-auto flex max-w-[420px] flex-col overflow-hidden rounded-[26px] border border-line bg-white shadow-card">
        {/* Cabecera estilo chat */}
        <div className="flex items-center gap-3 bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-3 text-white">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-lg"
          >
            🤖
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{businessName}</p>
            <p className="text-[12px] text-white/85">Recepcionista IA · modo prueba</p>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="ml-auto shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/25 disabled:opacity-50"
          >
            Reiniciar
          </button>
        </div>

        {/* Hilo */}
        <div
          ref={scrollRef}
          data-testid="probar-chat-messages"
          className="flex h-[380px] flex-col gap-2.5 overflow-y-auto bg-surface p-4"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-[14px] leading-relaxed ${
                m.me
                  ? 'self-end rounded-[16px_16px_4px_16px] bg-brand-100 text-ink'
                  : 'self-start rounded-[16px_16px_16px_4px] border border-line bg-white text-ink'
              }`}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div
              className="inline-flex gap-1 self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-4 py-3"
              aria-label="La IA está escribiendo"
            >
              <span className="cv-typing-dot" />
              <span className="cv-typing-dot" style={{ animationDelay: '0.2s' }} />
              <span className="cv-typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          )}
        </div>

        {/* Sugerencias (solo al inicio) */}
        {messages.length <= 1 && !busy && (
          <div className="flex flex-wrap gap-2 bg-surface px-4 pb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12.5px] text-brand-700 hover:bg-brand-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Entrada */}
        <div className="flex items-center gap-2 border-t border-line bg-white p-3">
          {limited ? (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600"
            >
              Reiniciar conversación
            </button>
          ) : (
            <>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send(input)
                }}
                placeholder="Escribe como un cliente…"
                data-testid="probar-chat-input"
                className="flex-1 rounded-xl border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                data-testid="probar-chat-send"
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
              >
                Enviar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
