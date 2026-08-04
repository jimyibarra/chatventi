'use client'

import { useEffect, useRef } from 'react'

// Widget de Cloudflare Turnstile (modo Managed: invisible para casi todo el
// mundo, solo aparece un reto si la señal es sospechosa).
//
// El token que produce NO prueba nada por sí solo: quien decide es el
// siteverify del servidor (shared/security/turnstile.ts). Esto es solo la
// mitad visible.
//
// Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no se renderiza nada y no se carga el
// script: en desarrollo el registro sigue funcionando.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ID = 'cf-turnstile-script'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    if (window.turnstile) return resolve()
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile_script')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile_script'))
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({
  onToken,
}: {
  /** Recibe el token, o null cuando expira o falla (hay que rehacer el reto). */
  onToken: (token: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // En un ref para no re-crear el widget si el padre cambia la función. Se
  // asigna en un efecto, no durante el render (mutar un ref al renderizar
  // rompe las garantías de React y lo caza el lint).
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let widgetId: string | null = null
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => {
        // Sin script no hay token; el servidor rechazará el alta y el usuario
        // verá el aviso de "no pudimos verificar". Preferimos eso a dejar
        // pasar sin verificar.
        onTokenRef.current(null)
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // El widget ya no existe: nada que limpiar.
        }
      }
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={containerRef} className="flex justify-center" />
}
