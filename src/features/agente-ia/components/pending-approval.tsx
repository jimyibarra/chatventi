'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resolveApprovalFromPanel } from '../approval-actions'
import { COMPOSER_DRAFT_EVENT } from './message-composer'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

/**
 * Respuesta de la recepcionista que espera visto bueno, justo encima del
 * cuadro de mensaje. Tres salidas: enviarla tal cual, pasarla al cuadro para
 * editarla (al enviarla queda como «Respondiste tú») o descartarla.
 */
export function PendingApproval({ approvalId, draft }: { approvalId: string; draft: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function resolve(approve: boolean) {
    setError(null)
    start(async () => {
      const res = await resolveApprovalFromPanel(approvalId, approve)
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  function edit() {
    window.dispatchEvent(new CustomEvent(COMPOSER_DRAFT_EVENT, { detail: draft }))
  }

  return (
    <div className="border-t-2 border-[#ffcd2e] bg-[#fff8db] p-3 md:p-4" data-testid="pending-approval">
      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icon name="robot" className="h-4 w-4" />
        La recepcionista propone esta respuesta
      </p>
      <p className="mb-3 whitespace-pre-wrap rounded-[12px] bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">
        {draft}
      </p>
      {error && (
        <p className="mb-2.5 rounded-[12px] bg-[#fde3e1] px-3 py-2 text-sm text-[#8f1714]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => resolve(true)} disabled={pending} data-testid="approval-send">
          <Icon name="send" className="h-4 w-4" />
          {pending ? 'Enviando…' : 'Enviar tal cual'}
        </Button>
        <Button size="sm" variant="secondary" onClick={edit} disabled={pending} data-testid="approval-edit">
          Editar antes de enviar
        </Button>
        <Button size="sm" variant="danger" onClick={() => resolve(false)} disabled={pending} data-testid="approval-discard">
          Descartar
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
        Mientras no la resuelvas, la recepcionista no vuelve a contestar este chat. Si escribes tu propia respuesta abajo, esta se cierra sola.
      </p>
    </div>
  )
}
