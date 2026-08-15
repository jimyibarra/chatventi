'use client'

import { useEffect, useRef, useState } from 'react'

// Widget flotante del ASESOR DE VENTAS (Pieza A). Reemplaza al antiguo FAB que
// aparentaba WhatsApp pero llevaba a /signup (dark pattern): ahora el botón SÍ
// abre un chat, atendido por la IA de ChatVenti, que resuelve dudas 24/7 y
// empuja al registro. El CTA directo "Prueba gratis" sigue presente (abajo).

type Turn = { role: 'user' | 'assistant'; content: string }

const GREETING =
  '¡Hola! 👋 Soy el asistente de ChatVenti. Te resuelvo cualquier duda al instante: precios, si sirve para tu negocio, cómo empezar… ¿Qué te gustaría saber?'

const SUGGESTIONS = ['¿Cuánto cuesta?', '¿Sirve para mi negocio?', '¿Cómo empiezo?']

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
      const reply = data?.reply ?? 'Ups, no pude responder ahora mismo. Intenta de nuevo 🙏'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ups, no pude responder. Intenta de nuevo en un momento 🙏' },
      ])
    }
    setBusy(false)
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat con el asistente de ChatVenti'}
        className="cv-pulse"
        style={{
          position: 'fixed',
          bottom: 22,
          right: 22,
          zIndex: 60,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: open ? 14 : '14px 22px',
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15.5,
          background: 'linear-gradient(120deg, #1DA851, #25D366)',
          boxShadow: '0 12px 30px rgba(18,140,74,0.42)',
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3C6.9 3 2.8 6.4 2.8 10.6c0 2 1 3.9 2.6 5.2-.1 1-.5 2.3-1.4 3.5 1.6-.2 3-.8 4-1.5 1 .3 2.2.5 3.2.5 5.1 0 9.2-3.4 9.2-7.7C20.4 6.4 16.3 3 12 3z" />
            </svg>
            Chatea con nosotros
          </>
        )}
      </button>

      {/* Panel de chat */}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente de ChatVenti"
          style={{
            position: 'fixed',
            bottom: 88,
            right: 22,
            zIndex: 60,
            width: 'min(380px, calc(100vw - 44px))',
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 30px 70px rgba(32,27,54,0.28)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #ECE9F5',
          }}
        >
          <div style={{ padding: '14px 18px', background: 'linear-gradient(120deg, #5b4fe0, #4338ca)', color: '#fff', display: 'flex', alignItems: 'center', gap: 11 }}>
            <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', fontSize: 17 }}>💬</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>Asistente de ChatVenti</p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
                <span className="cv-pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#4ade80', marginRight: 6 }} />
                Respondemos al instante · IA en vivo
              </p>
            </div>
          </div>

          <div ref={scrollRef} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9, height: 320, overflowY: 'auto', background: '#FBFAF6' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
                  background: m.role === 'user' ? '#DCF8C6' : '#fff',
                  border: '1px solid #ECE9F5',
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: 'flex-start', padding: '11px 15px', borderRadius: '15px 15px 15px 4px', background: '#fff', border: '1px solid #ECE9F5', display: 'inline-flex', gap: 4 }} aria-label="Escribiendo">
                <span className="cv-typing-dot" />
                <span className="cv-typing-dot" style={{ animationDelay: '0.2s' }} />
                <span className="cv-typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 7, flexWrap: 'wrap', background: '#FBFAF6' }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} style={{ border: '1px solid #C7BFF5', background: '#F4F2FE', color: '#4338CA', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: 12, borderTop: '1px solid #ECE9F5', display: 'flex', gap: 9, alignItems: 'center', background: '#fff' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input)
              }}
              placeholder="Escribe tu pregunta…"
              style={{ flex: 1, border: '1px solid #ECE9F5', borderRadius: 11, padding: '10px 13px', fontSize: 14, outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              style={{ background: '#5b4fe0', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 15px', fontSize: 14, fontWeight: 600, cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              Enviar
            </button>
          </div>

          {/* CTA directo SIEMPRE presente: quien ya se decidió no tiene que chatear. */}
          <a href="/signup" style={{ display: 'block', textAlign: 'center', padding: '11px 16px', background: '#F4F2FE', color: '#4338CA', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', borderTop: '1px solid #ECE9F5' }}>
            ⚡ Prefiero empezar ya — Prueba gratis 14 días
          </a>
        </div>
      )}
    </>
  )
}
