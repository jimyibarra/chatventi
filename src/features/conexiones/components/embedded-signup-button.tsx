'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/shared/components/ui/icon'

const GRAPH_VERSION = 'v25.0'

// Datos que Meta emite por postMessage al terminar el Embedded Signup.
interface SessionInfo {
  phone_number_id: string
  waba_id: string
}

// Último evento de Meta que NO terminó en un número conectado. Sirve para
// decirle al dueño qué pasó en vez de un genérico "conexión cancelada".
type SignupOutcome =
  | { kind: 'cancel'; step?: string }
  | { kind: 'error'; message: string; sessionId?: string }
  | { kind: 'unsupported'; event: string }

// Códigos que devuelve /api/whatsapp/embedded-signup, dichos como los entiende un dueño.
const SERVER_ERRORS: Record<string, string> = {
  number_in_use: 'Ese número ya está conectado a otra cuenta de ChatVenti.',
  phone_not_accessible:
    'Meta no confirmó que ese número pertenezca a la cuenta que autorizaste. Vuelve a intentarlo.',
  token_exchange_failed:
    'La autorización de Meta caducó antes de terminar (dura 30 segundos). Vuelve a intentarlo.',
  token_exchange_error: 'No se pudo completar la autorización con Meta. Vuelve a intentarlo.',
  forbidden: 'Solo el dueño o un administrador puede conectar WhatsApp.',
  unauthorized: 'Tu sesión terminó. Inicia sesión y vuelve a intentarlo.',
}

function outcomeMessage(o: SignupOutcome | null): string {
  if (!o) return 'Conexión cancelada o sin autorización.'
  if (o.kind === 'cancel') {
    return o.step
      ? `Cerraste la conexión antes de terminar (paso: ${o.step}). Puedes volver a intentarlo.`
      : 'Cerraste la conexión antes de terminar. Puedes volver a intentarlo.'
  }
  if (o.kind === 'error') {
    return `Meta reportó un error: ${o.message}${o.sessionId ? ` (referencia para soporte: ${o.sessionId})` : ''}`
  }
  if (o.event === 'FINISH_ONLY_WABA') {
    return 'Conectaste la cuenta pero sin número. Vuelve a intentarlo y agrega el número de WhatsApp.'
  }
  if (o.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
    return 'Por ahora no se puede usar un número que siga activo en la app WhatsApp Business.'
  }
  return 'Meta terminó el proceso sin entregar un número de WhatsApp. Vuelve a intentarlo.'
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
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const sessionRef = useRef<SessionInfo | null>(null)
  const outcomeRef = useRef<SignupOutcome | null>(null)

  // 1. Cargar el SDK de Facebook una sola vez e inicializarlo.
  useEffect(() => {
    if (!appId) return
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION })
    }
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script')
      js.id = 'facebook-jssdk'
      js.src = 'https://connect.facebook.net/es_LA/sdk.js'
      js.async = true
      js.defer = true
      document.body.appendChild(js)
    } else if (window.FB) {
      window.fbAsyncInit()
    }
  }, [appId])

  // 2. Capturar lo que Meta manda por postMessage (Embedded Signup v4): el
  //    número conectado (FINISH), el abandono o el error (CANCEL) y los finales
  //    que no traen número utilizable (FINISH_ONLY_WABA, coexistencia…).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Solo facebook.com y sus subdominios. `endsWith('facebook.com')` a secas
      // dejaría pasar un dominio como `notfacebook.com`.
      let host = ''
      try {
        host = new URL(event.origin).hostname
      } catch {
        return
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return
      try {
        const data: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (
          data &&
          typeof data === 'object' &&
          (data as { type?: string }).type === 'WA_EMBEDDED_SIGNUP'
        ) {
          const payload = data as { event?: string; data?: Record<string, string | undefined> }
          const d = payload.data ?? {}
          // Solo identificadores, nunca tokens: ayuda a soporte a seguir un alta.
          console.info('[embedded-signup]', payload.event, {
            phone_number_id: d.phone_number_id,
            waba_id: d.waba_id,
            current_step: d.current_step,
            error_code: d.error_code,
            session_id: d.session_id,
          })
          if (payload.event === 'FINISH' && d.phone_number_id && d.waba_id) {
            sessionRef.current = { phone_number_id: d.phone_number_id, waba_id: d.waba_id }
          } else if (payload.event === 'CANCEL') {
            outcomeRef.current = d.error_message
              ? { kind: 'error', message: d.error_message, sessionId: d.session_id }
              : { kind: 'cancel', step: d.current_step }
          } else if (payload.event) {
            outcomeRef.current = { kind: 'unsupported', event: payload.event }
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
    outcomeRef.current = null
    setState({ kind: 'loading' })

    window.FB.login(
      (response) => {
        void (async () => {
          const code = response.authResponse?.code
          const session = sessionRef.current
          if (!code) {
            setState({ kind: 'error', detail: outcomeMessage(outcomeRef.current) })
            return
          }
          if (!session) {
            setState({
              kind: 'error',
              detail: outcomeRef.current
                ? outcomeMessage(outcomeRef.current)
                : 'No se recibió el número de WhatsApp de Meta. Reintenta el flujo completo.',
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
              const code = (json as { error?: string })?.error
              setState({
                kind: 'error',
                detail:
                  (code && SERVER_ERRORS[code]) ??
                  `No se pudo registrar el canal (${code ?? `error ${res.status}`}). Vuelve a intentarlo.`,
              })
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
            // La lista de canales es del servidor: sin esto el número no aparece hasta recargar.
            router.refresh()
          } catch (err) {
            setState({ kind: 'error', detail: `Fallo de red: ${String(err)}` })
          }
        })()
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // Embedded Signup v4: la versión la fija la configuración (config_id),
        // no el código. v2/v3 (featureType, sessionInfoVersion) se retiran el
        // 15-oct-2026.
        extras: { setup: {} },
      }
    )
  }, [configId, router])

  const disabled = !appId || !configId || state.kind === 'loading'

  return (
    <div className="space-y-2.5">
      {/* Verde de WhatsApp oscurecido para que el texto blanco se lea (≥ 4.5:1). */}
      <button
        type="button"
        onClick={connect}
        disabled={disabled}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[13px] bg-[#0b7d47] px-4 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#096b3c] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[40px]"
      >
        <Icon name="whatsapp" />
        {state.kind === 'loading' ? 'Conectando…' : 'Conectar WhatsApp'}
      </button>

      {!configId && (
        <p className="text-[13px] text-[#8a5a00]">
          Falta configurar <code className="font-mono">NEXT_PUBLIC_META_CONFIG_ID</code> (el Embedded Signup de Meta).
        </p>
      )}
      {state.kind === 'ok' && (
        <p className="flex items-start gap-1.5 text-sm font-semibold text-[#0b5d36]" role="status">
          <Icon name="check" className="mt-px h-4 w-4" strokeWidth={2.6} />
          {state.detail}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="flex items-start gap-1.5 text-sm text-[#a51b18]" role="alert">
          <Icon name="alert" className="mt-px h-4 w-4" />
          {state.detail}
        </p>
      )}
    </div>
  )
}
