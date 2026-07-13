'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAiEnabled, pauseAi, resumeAi, setConversationStatus } from '../actions'

export function ConversationControls({
  conversationId,
  aiEnabled,
  aiPausedUntil,
}: {
  conversationId: string
  aiEnabled: boolean
  aiPausedUntil: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const paused = aiPausedUntil ? new Date(aiPausedUntil) > new Date() : false

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => run(() => setAiEnabled(conversationId, !aiEnabled))}
        disabled={pending}
        data-testid="toggle-ai"
        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
          aiEnabled
            ? 'border-success-bg bg-success-bg text-success'
            : 'border-line bg-surface text-ink-soft'
        }`}
      >
        IA {aiEnabled ? 'activa' : 'apagada'}
      </button>
      {aiEnabled && !paused && (
        <button
          onClick={() => run(() => pauseAi(conversationId, 60))}
          disabled={pending}
          data-testid="pause-ai"
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
        >
          Pausar 1 h
        </button>
      )}
      {aiEnabled && paused && (
        <span
          className="rounded-lg border border-warn-bg bg-warn-bg px-2.5 py-1 text-xs font-medium text-warn"
          data-testid="ai-paused-badge"
        >
          IA pausada hasta{' '}
          {new Date(aiPausedUntil!).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}
      {aiEnabled && paused && (
        <button
          onClick={() => run(() => resumeAi(conversationId))}
          disabled={pending}
          data-testid="resume-ai"
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
        >
          Reanudar
        </button>
      )}
      <button
        onClick={() => run(() => setConversationStatus(conversationId, 'closed'))}
        disabled={pending}
        className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
      >
        Cerrar
      </button>
    </div>
  )
}
