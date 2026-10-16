'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendManualReply } from '../actions'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { CONTROL } from '@/shared/components/ui/field'

/**
 * Evento con el que «Editar antes de enviar» (respuesta pendiente de la IA)
 * pone el borrador en este cuadro. Un evento de ventana evita cablear estado
 * entre dos componentes que viven en partes distintas de la página.
 */
export const COMPOSER_DRAFT_EVENT = 'cv:composer-draft'

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function onDraft(e: Event) {
      const draft = (e as CustomEvent<string>).detail
      if (typeof draft !== 'string') return
      setText(draft)
      setError(null)
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(draft.length, draft.length)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    window.addEventListener(COMPOSER_DRAFT_EVENT, onDraft)
    return () => window.removeEventListener(COMPOSER_DRAFT_EVENT, onDraft)
  }, [])

  function send() {
    const value = text.trim()
    if (!value || pending) return
    setError(null)
    startTransition(async () => {
      const res = await sendManualReply(conversationId, value)
      if (res.ok) {
        setText('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="border-t border-line bg-white p-3 md:p-4">
      {error && (
        <p
          className="mb-2.5 rounded-[12px] bg-[#fde3e1] px-3 py-2 text-sm text-[#8f1714]"
          role="alert"
          data-testid="composer-error"
        >
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tu respuesta</span>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={text.length > 140 ? 5 : 2}
            placeholder="Escribe una respuesta…"
            data-testid="composer-input"
            className={`${CONTROL} w-full resize-none py-2.5 leading-snug`}
          />
        </label>
        <Button onClick={send} disabled={pending || !text.trim()} data-testid="composer-send" className="self-stretch">
          <Icon name="send" className="h-[18px] w-[18px]" />
          {pending ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
        Al enviar, la recepcionista se pausa 30 min en este chat. Enter envía; Shift + Enter hace un salto de línea.
      </p>
    </div>
  )
}
