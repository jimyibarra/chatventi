'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsePushSubscriptionReturn {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  loading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

function detectSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  // Estado inicial derivado en el primer render del cliente (sin setState
  // síncrono en effects — regla react-hooks/set-state-in-effect).
  const [isSupported] = useState(detectSupport)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    detectSupport() ? Notification.permission : 'unsupported'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupported) {
      // setState dentro de un callback async (permitido por la regla).
      Promise.resolve().then(() => setLoading(false))
      return
    }

    let active = true
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (!active) return
        setIsSubscribed(!!sub)
        setLoading(false)
      })
    })
    return () => {
      active = false
    }
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported) return
    setLoading(true)

    try {
      const currentPermission = await Notification.requestPermission()
      setPermission(currentPermission)

      if (currentPermission !== 'granted') {
        setLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready

      // Convertir VAPID key de base64url a Uint8Array (gotcha iOS/Chrome).
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = atob(base64)
      const applicationServerKey = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; i++) {
        applicationServerKey[i] = rawData.charCodeAt(i)
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // El servidor deriva el user de la sesión (no confía en el body).
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceInfo: {
            platform: navigator.platform,
            language: navigator.language,
            userAgent: navigator.userAgent,
          },
        }),
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('[Push] Subscribe failed:', err)
    }

    setLoading(false)
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      setIsSubscribed(false)
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err)
    }
    setLoading(false)
  }, [])

  return { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe }
}
