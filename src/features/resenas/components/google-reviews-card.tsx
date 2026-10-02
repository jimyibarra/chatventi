'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importHoursFromGoogle, saveReviewLink, searchMyBusiness } from '../actions'
import type { PlaceHit } from '../places'

export function GoogleReviewsCard({
  reviewUrl,
  hasPlace,
  searchAvailable,
  csatOn,
}: {
  reviewUrl: string | null
  hasPlace: boolean
  /** Hay clave de Google Places en el servidor: se puede buscar la ficha. */
  searchAvailable: boolean
  csatOn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [url, setUrl] = useState(reviewUrl ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function run(fn: () => Promise<{ ok: boolean; text: string }>) {
    setMsg(null)
    startTransition(async () => {
      const res = await fn()
      setMsg(res)
      if (res.ok) router.refresh()
    })
  }

  const search = () =>
    run(async () => {
      const res = await searchMyBusiness(query)
      if (!res.ok) return { ok: false, text: res.error }
      setHits(res.data ?? [])
      return { ok: true, text: 'Elige tu negocio de la lista.' }
    })

  const pick = (hit: PlaceHit) =>
    run(async () => {
      const res = await saveReviewLink({ placeId: hit.placeId })
      if (!res.ok) return { ok: false, text: res.error }
      setHits([])
      return { ok: true, text: `Listo: las reseñas irán a "${hit.name}".` }
    })

  const saveManual = () =>
    run(async () => {
      const res = await saveReviewLink({ url })
      return res.ok
        ? { ok: true, text: url ? 'Enlace guardado.' : 'Enlace quitado: ya no se pedirán reseñas.' }
        : { ok: false, text: res.error }
    })

  const importHours = () =>
    run(async () => {
      const res = await importHoursFromGoogle()
      return res.ok
        ? { ok: true, text: `Horario copiado de Google (${res.data} días con atención). Revísalo en Agenda → Configuración.` }
        : { ok: false, text: res.error }
    })

  return (
    <section className="rounded-card border border-line bg-white p-5" data-testid="google-reviews">
      <h2 className="text-base font-semibold text-ink">Reseñas en Google</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Después de cada visita, quien responde la encuesta recibe el enlace para dejarte una reseña.
        Se le envía a todos por igual: Google no permite pedir reseñas solo a los clientes contentos.
      </p>

      {!csatOn && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Enciende el superpoder “Encuesta al cliente” (arriba) para que el enlace empiece a enviarse.
        </p>
      )}

      <p className="mt-4 text-sm">
        {reviewUrl ? (
          <span className="font-medium text-success">● Activo</span>
        ) : (
          <span className="font-medium text-ink-faint">○ Sin enlace: no se piden reseñas</span>
        )}
        {reviewUrl && (
          <a href={reviewUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand-600 underline">
            Probar el enlace
          </a>
        )}
      </p>

      {searchAvailable && (
        <div className="mt-4">
          <label className="text-sm font-medium text-ink" htmlFor="gr-q">
            Busca tu negocio en Google
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="gr-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && query.trim().length >= 3 && search()}
              placeholder="Estética Lumen, Guadalajara"
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={search}
              disabled={pending || query.trim().length < 3}
              className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Buscar
            </button>
          </div>
          {hits.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {hits.map((h) => (
                <li key={h.placeId}>
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    disabled={pending}
                    className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <span className="block font-medium text-ink">{h.name}</span>
                    <span className="text-xs text-ink-muted">{h.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        <label className="text-sm font-medium text-ink" htmlFor="gr-url">
          {searchAvailable ? 'O pega tu enlace de reseñas' : 'Pega tu enlace de reseñas'}
        </label>
        <p className="mt-0.5 text-xs text-ink-faint">
          En tu Perfil de Negocio de Google: “Pedir opiniones” → copia el enlace.
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            id="gr-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveManual}
            disabled={pending || url === (reviewUrl ?? '')}
            className="shrink-0 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>

      {searchAvailable && hasPlace && (
        <button
          type="button"
          onClick={importHours}
          disabled={pending}
          className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
        >
          Copiar a mi agenda el horario que tengo en Google
        </button>
      )}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-success' : 'text-red-600'}`}>{msg.text}</p>}
    </section>
  )
}
