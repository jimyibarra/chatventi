'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAiEnabled, pauseAi, resumeAi, setConversationStatus } from '../actions'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip } from '@/shared/components/ui/status-chip'
import { fmtTime } from '@/shared/lib/format'

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
    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5" aria-busy={pending}>
      {/* Interruptor de la IA en esta conversación: verde y punto lleno si atiende. */}
      <button
        type="button"
        onClick={() => run(() => setAiEnabled(conversationId, !aiEnabled))}
        disabled={pending}
        data-testid="toggle-ai"
        aria-pressed={aiEnabled}
        title={aiEnabled ? 'La recepcionista contesta este chat. Toca para apagarla aquí.' : 'Toca para que la recepcionista vuelva a contestar este chat.'}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-[13px] px-3 text-sm font-semibold transition-colors duration-150 disabled:opacity-60 md:min-h-[36px] ${
          aiEnabled ? 'bg-[#d6f5e3] text-[#0b5d36] hover:bg-[#c3efd6]' : 'bg-[#e7e6f0] text-ink-muted hover:bg-[#dcdbe8]'
        }`}
      >
        <span
          className={`relative h-[14px] w-6 flex-none rounded-full transition-colors ${aiEnabled ? 'bg-[#0d9463]' : 'bg-[#a9a5bf]'}`}
          aria-hidden
        >
          <span
            className={`absolute left-[2px] top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${
              aiEnabled ? 'translate-x-[10px]' : 'translate-x-0'
            }`}
          />
        </span>
        IA {aiEnabled ? 'activa' : 'apagada'}
      </button>

      {aiEnabled && !paused && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => run(() => pauseAi(conversationId, 60))}
          disabled={pending}
          data-testid="pause-ai"
        >
          <Icon name="pause" className="hidden h-4 w-4 sm:block" />
          Pausar 1 h
        </Button>
      )}
      {aiEnabled && paused && (
        <span data-testid="ai-paused-badge" className="inline-flex">
          <StatusChip tone="off">
            IA pausada hasta {fmtTime(aiPausedUntil!)}
          </StatusChip>
        </span>
      )}
      {aiEnabled && paused && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => run(() => resumeAi(conversationId))}
          disabled={pending}
          data-testid="resume-ai"
        >
          <Icon name="play" className="hidden h-4 w-4 sm:block" />
          Reanudar
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => run(() => setConversationStatus(conversationId, 'closed'))}
        disabled={pending}
      >
        <Icon name="check" className="hidden h-4 w-4 sm:block" />
        Cerrar
      </Button>
    </div>
  )
}
