'use client'

import { useState, useEffect } from 'react'
import { usePushSubscription } from '../hooks/use-push-subscription'

// Prompt suave para activar push (skill add-mobile): aparece una sola vez,
// a los pocos segundos, y respeta el rechazo (localStorage).
export function PushNotificationPrompt({ autoShowDelay = 4000 }: { autoShowDelay?: number }) {
  const { isSupported, permission, isSubscribed, subscribe } = usePushSubscription()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isSupported || isSubscribed || permission === 'denied') return

    const dismissed = localStorage.getItem('push-prompt-dismissed')
    if (dismissed) return

    const timer = setTimeout(() => setShow(true), autoShowDelay)
    return () => clearTimeout(timer)
  }, [isSupported, isSubscribed, permission, autoShowDelay])

  if (!show) return null

  const handleEnable = async () => {
    localStorage.setItem('push-prompt-dismissed', 'true')
    await subscribe()
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('push-prompt-dismissed', 'true')
    setShow(false)
  }

  return (
    // Arriba a la derecha: abajo tapaba el botón Enviar del composer y los
    // botones de formularios (visto 2 veces en pruebas E2E).
    <div className="fixed right-4 top-16 z-50 max-w-sm space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">¿Activar notificaciones? 🔔</p>
      <p className="text-xs text-gray-500">
        Te avisamos cuando un cliente necesite a un humano o haya una respuesta esperando tu
        aprobación — aunque no tengas ChatVenti abierto.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          data-testid="push-enable"
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Activar
        </button>
        <button
          onClick={handleDismiss}
          data-testid="push-dismiss"
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
