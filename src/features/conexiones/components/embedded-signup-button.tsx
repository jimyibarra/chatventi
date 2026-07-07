'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const GRAPH_VERSION = 'v21.0'

// Datos que Meta emite por postMessage al terminar el Embedded Signup.
interface SessionInfo {
  phone_number_id: string
  waba_id: string
}

// Firma mínima del JS SDK de Facebook que usamos (evita `any`).
interface FBLoginResponse {
  authResponse?: { code?: string } | null
  status?: string
}
interface FBSdk {
  init(params: Record<string, unknown>): void
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    FB?: FBSdk
    fbAsyncInit?: () => void
  }
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; detail: string }
  | { kind: 'error'; detail: string }

export function EmbeddedSignupButton({
  appId,
  configId,
}: {
  appId: string
  configId: string
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const sessionRef = useRef<SessionInfo | null>(null)

  // 1. Cargar el SDK de Facebook una sola vez e inicializarlo.
  useEffect(() => {
    if (!appId) return
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION })
    }
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script')
      js.id = 'facebook-jssdk'
      js.src = 'https://connect.facebook.net/en_US/sdk.js'
      js.async = true
      js.defer = true
      document.body.appendChild(js)
    } else if (window.FB) {
      window.fbAsyncInit()
    }
  }, [appId])

  // 2. Capturar el sessionInfo (phone_number_id + waba_id) que Meta manda por postMessage.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return
      try {
        const data: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (
          data &&
          typeof data === 'object' &&
          (data as { type?: string }).type === 'WA_EMBEDDED_SIGNUP'
        ) {
          const payload = data as { event?: string; data?: Partial<SessionInfo> }
          if (payload.data?.phone_number_id && payload.data?.waba_id) {
            sessionRef.current = {
              phone_number_id: payload.data.phone_number_id,
              waba_id: payload.data.waba_id,
            }
          }
        }
      } catch {
        /* mensajes no-JSON de otros orígenes: ignorar */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const connect = useCallback(() => {
    if (!window.FB) {
      setState({ kind: 'error', detail: 'El SDK de Facebook aún no cargó. Reintenta en unos segundos.' })
      return
    }
    sessionRef.current = null
    setState({ kind: 'loading' })

    window.FB.login(
      (response) => {
        void (async () => {
          const code = response.authResponse?.code
          const session = sessionRef.current
          if (!code) {
            setState({ kind: 'error', detail: 'Conexión cancelada o sin autorización.' })
            return
          }
          if (!session) {
            setState({
              kind: 'error',
              detail: 'No se recibió el número/WABA de Meta. Reintenta el flujo completo.',
            })
            return
          }
          try {
            const res = await fetch('/api/whatsapp/embedded-signup', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                code,
                phoneNumberId: session.phone_number_id,
                wabaId: session.waba_id,
              }),
            })
            const json: unknown = await res.json().catch(() => null)
            if (!res.ok) {
              const detail =
                (json as { error?: string })?.error ?? `Error ${res.status} al registrar el canal.`
              setState({ kind: 'error', detail })
              return
            }
            const status = (json as { status?: string })?.status
            setState({
              kind: 'ok',
              detail:
                status === 'active'
                  ? 'WhatsApp conectado y activo.'
                  : 'WhatsApp vinculado; terminando de activar el número.',
            })
          } catch (err) {
            setState({ kind: 'error', detail: `Fallo de red: ${String(err)}` })
          }
        })()
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      }
    )
  }, [configId])

  const disabled = !appId || !configId || state.kind === 'loading'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={connect}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1eb958] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.kind === 'loading' ? 'Conectando…' : 'Conectar WhatsApp'}
      </button>

      {!configId && (
        <p className="text-xs text-amber-600">
          Falta configurar <code>NEXT_PUBLIC_META_CONFIG_ID</code> (el Embedded Signup de Meta).
        </p>
      )}
      {state.kind === 'ok' && <p className="text-sm text-green-600">✓ {state.detail}</p>}
      {state.kind === 'error' && <p className="text-sm text-red-600">✗ {state.detail}</p>}
    </div>
  )
}
