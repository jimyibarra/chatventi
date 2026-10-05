'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { TRIAL_DAYS } from '@/features/billing/plans'
import './sales-widget.css'

// Widget flotante del ASESOR DE VENTAS (Pieza A). Reemplaza al antiguo FAB que
// aparentaba WhatsApp pero llevaba a /signup (dark pattern): ahora el botón SÍ
// abre un chat, atendido por la IA de ChatVenti, que resuelve dudas 24/7 y
// empuja al registro. El CTA directo «Prueba gratis» sigue presente (abajo).

type Turn = { role: 'user' | 'assistant'; content: string }

const GREETING =
  'Hola, soy el asesor de ChatVenti. Pregúntame precios, cómo se conecta tu WhatsApp o si sirve para tu negocio.'

const SUGGESTIONS = ['¿Cuánto cuesta?', '¿Sirve para mi negocio?', '¿Qué necesito para WhatsApp?']

export function SalesWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Turn[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])

  async function send(text: string) {
    const value = text.trim()
    if (!value || busy) return
    setInput('')
    const next: Turn[] = [...messages, { role: 'user', content: value }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch('/api/ventas-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Recortamos a los últimos turnos (el servidor también lo hace).
        body: JSON.stringify({ messages: next.slice(-16) }),
      })
      const data = (await res.json().catch(() => null)) as { reply?: string } | null
      const reply = data?.reply ?? 'No pude responder ahora mismo. Intenta de nuevo.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'No pude responder. Intenta de nuevo en un momento.' }])
    }
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        className="cvw-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="cvw-panel"
        aria-label={open ? 'Cerrar el chat de ventas' : undefined}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
            </svg>
            <span className="cvw-txt">Chatea con nosotros</span>
          </>
        )}
      </button>

      {open && (
        <section id="cvw-panel" className="cvw-panel" aria-label="Chat de ventas de ChatVenti">
          <div className="cvw-head">
            <Image src="/brand/chatventi-icon.png" alt="" width={36} height={36} />
            <span><b>ChatVenti</b><small><i />Te contesta la IA al instante</small></span>
            <button type="button" className="cvw-x" onClick={() => setOpen(false)} aria-label="Cerrar chat">×</button>
          </div>

          <div ref={scrollRef} className="cvw-body" aria-live="polite">
            {messages.map((m, i) => (
              <p key={i} className={m.role === 'user' ? 'cvw-m c' : 'cvw-m a'}>{m.content}</p>
            ))}
            {busy && (
              <p className="cvw-m a cvw-typing" aria-label="Escribiendo">
                <span className="cv-dot" /><span className="cv-dot" /><span className="cv-dot" />
              </p>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="cvw-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <form className="cvw-row" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            <label htmlFor="cvw-input" style={{ position: 'absolute', left: -9999 }}>Escribe tu pregunta</label>
            <input
              id="cvw-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>

          {/* CTA directo SIEMPRE presente: quien ya se decidió no tiene que chatear. */}
          <a className="cvw-cta" href="/signup">Prefiero empezar ya: prueba gratis {TRIAL_DAYS} días</a>
        </section>
      )}
    </>
  )
}
