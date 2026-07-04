'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAiEnabled, pauseAi, setConversationStatus } from '../actions'

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
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-gray-300 bg-gray-50 text-gray-500'
        }`}
      >
        IA {aiEnabled ? 'activa' : 'apagada'}
      </button>
      {aiEnabled && (
        <button
          onClick={() => run(() => pauseAi(conversationId, 60))}
          disabled={pending}
          data-testid="pause-ai"
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          {paused ? 'En pausa' : 'Pausar 1 h'}
        </button>
      )}
      <button
        onClick={() => run(() => setConversationStatus(conversationId, 'closed'))}
        disabled={pending}
        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
      >
        Cerrar
      </button>
    </div>
  )
}
