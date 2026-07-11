'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { me: boolean; text: string }

const GREETING =
  '¡Hola! 😊 Soy la recepcionista IA de Estética Demo. Puedo darte precios, horarios y agendarte una cita de verdad. ¿En qué te ayudo?'

const SUGGESTIONS = [
  '¿Tienen lugar mañana para un corte?',
  '¿Cuánto cuesta el tinte?',
  '¿Dónde están ubicados?',
]

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'cv-demo-session'
  let id = window.sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    window.sessionStorage.setItem(key, id)
  }
  return id
}

// Demo EN VIVO del agente (Ola 3 Fase C): conversa con la org demo usando
// el mismo motor de producción, con tope de mensajes por sesión.
export function DemoChat() {
  const [sessionId] = useState(getSessionId)
  const [messages, setMessages] = useState<Msg[]>([{ me: false, text: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    const value = text.trim()
    if (!value || busy || done) return
    setInput('')
    setMessages((prev) => [...prev, { me: true, text: value }])
    setBusy(true)
    try {
      const res = await fetch('/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: value }),
      })
      const data = (await res.json().catch(() => null)) as {
        reply?: string
        limited?: boolean
        remaining?: number
      } | null
      const reply = data?.reply ?? 'Ups, la demo está muy solicitada ahora mismo. Intenta de nuevo en un momento 🙏'
      setMessages((prev) => [...prev, { me: false, text: reply }])
      if (data?.limited || data?.remaining === 0) setDone(true)
    } catch {
      setMessages((prev) => [
        ...prev,
        { me: false, text: 'Ups, no pude responder. Intenta de nuevo en un momento 🙏' },
      ])
    }
    setBusy(false)
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 30px 70px rgba(32,27,54,0.16)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        width: '100%',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(120deg, #5b4fe0, #4338ca)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          💇‍♀️
        </span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Estética Demo ChatVenti</p>
          <p style={{ margin: 0, fontSize: 12.5, opacity: 0.85 }}>
            IA real respondiendo en vivo · agenda de verdad
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        data-testid="demo-chat-messages"
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: 340,
          overflowY: 'auto',
          background: '#FBFAF6',
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.me ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: m.me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.me ? '#DCF8C6' : '#fff',
              border: '1px solid #ECE9F5',
              fontSize: 14.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: '#fff',
              border: '1px solid #ECE9F5',
              display: 'inline-flex',
              gap: 4,
            }}
            aria-label="La IA está escribiendo"
          >
            <span className="cv-typing-dot" />
            <span className="cv-typing-dot" style={{ animationDelay: '0.2s' }} />
            <span className="cv-typing-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '0 18px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#FBFAF6' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              style={{
                border: '1px solid #C7BFF5',
                background: '#F4F2FE',
                color: '#4338CA',
                borderRadius: 999,
                padding: '7px 13px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: '1px solid #ECE9F5', display: 'flex', gap: 10 }}>
        {done ? (
          <a
            href="/signup"
            className="cv-btn-primary"
            style={{ padding: '12px 20px', fontSize: 15, width: '100%', textAlign: 'center' }}
          >
            Crear mi recepcionista IA gratis
          </a>
        ) : (
          <>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input)
              }}
              placeholder="Escríbele como si fueras un cliente…"
              data-testid="demo-chat-input"
              style={{
                flex: 1,
                border: '1px solid #ECE9F5',
                borderRadius: 12,
                padding: '11px 14px',
                fontSize: 14.5,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              data-testid="demo-chat-send"
              style={{
                background: '#5b4fe0',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '11px 18px',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: busy || !input.trim() ? 'default' : 'pointer',
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
