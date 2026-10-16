'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'

/**
 * Historial opcional del número en coexistencia: el dueño decide si trae sus
 * pláticas (últimos 90 días) y contactos. Meta solo lo permite en las primeras
 * 24 horas tras conectar.
 */
export function HistoryButton({ state, windowOpen }: { state: string | null; windowOpen: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')

  function call(method: 'POST' | 'DELETE') {
    setMsg('')
    start(async () => {
      const res = await fetch('/api/whatsapp/coexistence/history', { method })
      const json = (await res.json().catch(() => null)) as { error?: string; deleted?: number } | null
      if (!res.ok) {
        setMsg(
          json?.error === 'window_closed'
            ? 'Meta solo deja traer el historial en las primeras 24 horas después de conectar.'
            : 'Meta no aceptó la solicitud. Vuelve a intentarlo en unos minutos.'
        )
        return
      }
      setMsg(method === 'DELETE' ? `Listo: se borraron ${json?.deleted ?? 0} mensajes importados.` : 'Listo: Meta te va a pedir permiso en tu app de WhatsApp Business. Acepta ahí para traer tus pláticas.')
      router.refresh()
    })
  }

  const imported = state === 'importing' || state === 'done'
  return (
    <div className="space-y-2 text-[14px] text-ink-muted" data-testid="coex-history">
      {state === null && windowOpen && (
        <>
          <p className="max-w-[65ch]">
            ¿Quieres que tu recepcionista conozca tus pláticas recientes? Podemos traer los últimos 90 días de tu app y los nombres de tus contactos. Es opcional y solo se puede hoy: Meta lo permite en las primeras 24 horas después de conectar.
          </p>
          <Button size="sm" variant="secondary" onClick={() => call('POST')} disabled={pending}>
            {pending ? 'Pidiendo…' : 'Traer mis pláticas de los últimos 90 días'}
          </Button>
        </>
      )}
      {state === 'requested' && <p>Pedimos tu historial. Acepta en tu app de WhatsApp Business cuando te lo pregunte.</p>}
      {state === 'declined' && <p>Elegiste no compartir tu historial. Tu recepcionista empieza con las pláticas nuevas.</p>}
      {state === 'failed' && <p>Meta no aceptó la solicitud del historial. Tu recepcionista funciona igual con las pláticas nuevas.</p>}
      {imported && (
        <div className="flex flex-wrap items-center gap-2">
          <span>{state === 'done' ? 'Tu historial ya está en Chats.' : 'Estamos trayendo tu historial a Chats.'}</span>
          <Button size="sm" variant="ghost" onClick={() => call('DELETE')} disabled={pending}>
            Borrar lo importado
          </Button>
        </div>
      )}
      {state === 'deleted' && <p>Borraste el historial importado.</p>}
      {msg && <p role="status">{msg}</p>}
    </div>
  )
}
