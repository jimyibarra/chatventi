'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, type ButtonSize, type ButtonVariant } from '@/shared/components/ui/button'
import { publishMyTemplates, publishTemplatesAdmin, type PublishResult } from '../actions'

function message(res: PublishResult): { ok: boolean; text: string } {
  if (!res.ok) return { ok: false, text: res.error }
  const { created, failed } = res.summary
  if (failed.length > 0) {
    const first = failed[0]
    return { ok: false, text: `Meta no aceptó ${failed.length === 1 ? 'una plantilla' : `${failed.length} plantillas`}: ${first.error}` }
  }
  if (created === 0) return { ok: true, text: 'No faltaba ninguna: todas ya están en Meta.' }
  return { ok: true, text: `Pedimos ${created === 1 ? '1 plantilla' : `${created} plantillas`} a Meta. Quedan en revisión unos minutos.` }
}

/** Pide a Meta las plantillas que falten. `scope="owner"` actúa sobre el negocio de quien la toca. */
export function PublishButton({
  scope,
  channelId,
  label,
  variant = 'primary',
  size = 'md',
}: {
  scope: 'admin' | 'owner'
  channelId?: string
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  function run() {
    setResult(null)
    start(async () => {
      const res = scope === 'admin' ? await publishTemplatesAdmin(channelId) : await publishMyTemplates()
      setResult(message(res))
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={run} disabled={pending} data-testid="publish-templates">
        {pending ? 'Pidiendo a Meta…' : label}
      </Button>
      {result && (
        <span role="status" className={`max-w-[34rem] text-[13px] ${result.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`}>
          {result.text}
        </span>
      )}
    </span>
  )
}
