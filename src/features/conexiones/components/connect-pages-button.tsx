'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/shared/components/ui/icon'

const GRAPH_VERSION = 'v25.0'

// Lo que devuelve /api/meta/connect-pages, dicho como lo entiende un dueño.
const SERVER_ERRORS: Record<string, string> = {
  plan_required: 'Instagram y Messenger están incluidos desde el plan Profesional. Cambia de plan en Facturación.',
  no_pages: 'No autorizaste ninguna página. Vuelve a intentarlo y marca la página de tu negocio.',
  no_page_token: 'Meta no nos dio acceso a esa página. Debes ser administrador de la página para conectarla.',
  page_in_use: 'Esa página ya está conectada a otra cuenta de ChatVenti.',
  token_exchange_failed: 'La autorización de Meta caducó antes de terminar. Vuelve a intentarlo.',
  token_invalid: 'Meta no validó la autorización. Vuelve a intentarlo.',
  forbidden: 'Solo el dueño o un gerente puede conectar canales.',
  unauthorized: 'Tu sesión terminó. Inicia sesión y vuelve a intentarlo.',
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; detail: string }
  | { kind: 'error'; detail: string }

/**
 * Conecta la página de Facebook (Messenger) y su Instagram con el inicio de
 * sesión para empresas de Meta. Mismo SDK que el alta de WhatsApp (los tipos
 * de `window.FB` se declaran en embedded-signup-button.tsx).
 */
export function ConnectPagesButton({ appId, configId }: { appId: string; configId: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (!appId) return
    const init = () => window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION })
    if (window.FB) return init()
    // Si el botón de WhatsApp ya pidió el SDK, se respeta su inicialización.
    if (!window.fbAsyncInit) window.fbAsyncInit = init
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script')
      js.id = 'facebook-jssdk'
      js.src = 'https://connect.facebook.net/en_US/sdk.js'
      js.async = true
      js.defer = true
      document.body.appendChild(js)
    }
  }, [appId])

  const connect = useCallback(() => {
    if (!window.FB) {
      setState({ kind: 'error', detail: 'El inicio de sesión de Facebook aún no cargó. Reintenta en unos segundos.' })
      return
    }
    setState({ kind: 'loading' })
    window.FB.login(
      (response) => {
        void (async () => {
          const code = response.authResponse?.code
          if (!code) {
            setState({ kind: 'error', detail: 'Cerraste la ventana de Facebook antes de terminar. Puedes volver a intentarlo.' })
            return
          }
          try {
            const res = await fetch('/api/meta/connect-pages', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code }),
            })
            const json = (await res.json().catch(() => null)) as
              | { error?: string; connected?: { type: string; name: string; status: string }[] }
              | null
            if (!res.ok) {
              const err = json?.error
              setState({
                kind: 'error',
                detail: (err && SERVER_ERRORS[err]) ?? `No se pudo conectar (${err ?? `error ${res.status}`}). Vuelve a intentarlo.`,
              })
              return
            }
            const names = (json?.connected ?? []).map((c) => `${c.type === 'instagram' ? 'Instagram' : 'Messenger'} ${c.name}`)
            const hasIg = (json?.connected ?? []).some((c) => c.type === 'instagram')
            setState({
              kind: 'ok',
              detail: `Conectado: ${names.join(' y ')}.${hasIg ? '' : ' Esa página no tiene un Instagram profesional enlazado: enlázalo en Facebook y vuelve a conectar.'}`,
            })
            router.refresh()
          } catch (err) {
            setState({ kind: 'error', detail: `Fallo de red: ${String(err)}` })
          }
        })()
      },
      { config_id: configId, response_type: 'code', override_default_response_type: true }
    )
  }, [configId, router])

  return (
    <div className="space-y-2.5">
      {/* Azul de Facebook oscurecido para que el texto blanco se lea (≥ 4.5:1). */}
      <button
        type="button"
        onClick={connect}
        disabled={!appId || !configId || state.kind === 'loading'}
        data-testid="connect-pages"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[13px] bg-[#1468d6] px-4 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#1159b8] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[40px]"
      >
        <Icon name="messenger" />
        {state.kind === 'loading' ? 'Conectando…' : 'Conectar Facebook e Instagram'}
      </button>
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
