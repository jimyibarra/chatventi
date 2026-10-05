'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { me: boolean; text: string }

const GREETING =
  'Hola, soy la recepcionista de Estética Demo. Puedo darte precios, horarios y agendarte una cita de verdad. ¿En qué te ayudo?'

const SUGGESTIONS = ['¿Tienen lugar mañana para corte?', '¿Cuánto cuesta el tinte?', '¿Dónde están ubicados?']

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
// el mismo motor de producción, con tope de mensajes por sesión. Vive dentro
// de la home «Líneas» y usa sus clases (.lx).
export function DemoChat() {
  const [sessionId] = useState(getSessionId)
  const [messages, setMessages] = useState<Msg[]>([{ me: false, text: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el && messages.length > 1) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
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
      const data = (await res.json().catch(() => null)) as { reply?: string; limited?: boolean; remaining?: number } | null
      const reply = data?.reply ?? 'La demo está muy solicitada ahora mismo. Intenta de nuevo en un momento.'
      setMessages((prev) => [...prev, { me: false, text: reply }])
      if (data?.limited || data?.remaining === 0) setDone(true)
    } catch {
      setMessages((prev) => [...prev, { me: false, text: 'No pude responder. Intenta de nuevo en un momento.' }])
    }
    setBusy(false)
  }

  return (
    <div className="demo-card">
      <div className="chat-head">
        <span className="av" style={{ background: 'var(--brand)' }}>E</span>
        <span><b>Estética Demo</b><small>Recepcionista IA · en línea</small></span>
        <span className="live"><i />IA real</span>
      </div>
      <div ref={scrollRef} className="demo-msgs" data-testid="demo-chat-messages" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={m.me ? 'm c' : 'm a'}>{m.text}</p>
        ))}
        {busy && <p className="m a typing" aria-label="La IA está escribiendo"><i /><i /><i /></p>}
      </div>
      {messages.length <= 1 && (
        <div className="suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
      {done ? (
        <div className="inputrow">
          <a className="btn btn-primary" href="/signup" style={{ flex: 1 }}>Crear mi recepcionista gratis</a>
        </div>
      ) : (
        <form className="inputrow" onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <label htmlFor="demo-input" className="sr">Escribe como si fueras un cliente</label>
          <input
            id="demo-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe como si fueras un cliente…"
            autoComplete="off"
            data-testid="demo-chat-input"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()} data-testid="demo-chat-send">Enviar</button>
        </form>
      )}
    </div>
  )
}
