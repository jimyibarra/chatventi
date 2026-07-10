'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendManualReply } from '../actions'

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    <div className="mt-4">
      {error && (
        <p
          className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          data-testid="composer-error"
        >
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="Escribe una respuesta… (al enviar, la IA se pausa 30 min)"
          data-testid="composer-input"
          className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={pending || !text.trim()}
          data-testid="composer-send"
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
