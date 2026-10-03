'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importHoursFromGoogle, saveReviewLink, searchMyBusiness } from '../actions'
import type { PlaceHit } from '../places'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip } from '@/shared/components/ui/status-chip'

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
    <Section
      data-testid="google-reviews"
      title="Reseñas en Google"
      badge={
        reviewUrl ? (
          <StatusChip tone="ok" size="md">Activo</StatusChip>
        ) : (
          <StatusChip tone="off" size="md">Sin enlace</StatusChip>
        )
      }
      description="Después de cada visita, quien responde la encuesta recibe el enlace para dejarte una reseña. Se le envía a todos por igual: Google no permite pedir reseñas solo a los clientes contentos."
      actions={
        reviewUrl ? (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[11px] px-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Probar el enlace
            <Icon name="external" className="h-4 w-4" />
          </a>
        ) : undefined
      }
    >
      {!csatOn && (
        <Notice tone="action" size="sm" className="mb-4">
          Enciende el superpoder «Pregunta qué tal fue» (arriba) para que el enlace empiece a enviarse.
        </Notice>
      )}
      {!reviewUrl && (
        <p className="mb-4 text-[14px] text-ink-muted">Sin enlace no se piden reseñas.</p>
      )}

      {searchAvailable && (
        <div className="mb-4">
          <Field as="div" label="Busca tu negocio en Google">
            <div className="flex gap-2">
              <Input
                id="gr-q"
                aria-label="Busca tu negocio en Google"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && query.trim().length >= 3 && search()}
                placeholder="Estética Lumen, Guadalajara"
                className="min-w-0 flex-1"
              />
              <Button onClick={search} disabled={pending || query.trim().length < 3}>
                <Icon name="search" />
                Buscar
              </Button>
            </div>
          </Field>
          {hits.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {hits.map((h) => (
                <li key={h.placeId}>
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    disabled={pending}
                    className="flex w-full items-center gap-3 rounded-[13px] bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <Icon name="globe" className="h-5 w-5 text-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{h.name}</span>
                      <span className="block text-[13px] text-ink-muted">{h.address}</span>
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 text-ink-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Field
        as="div"
        label={searchAvailable ? 'O pega tu enlace de reseñas' : 'Pega tu enlace de reseñas'}
        hint="En tu Perfil de Negocio de Google: «Pedir opiniones» → copia el enlace."
      >
        <div className="flex gap-2">
          <Input
            id="gr-url"
            aria-label="Enlace de reseñas"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            className="min-w-0 flex-1"
          />
          <Button variant="secondary" onClick={saveManual} disabled={pending || url === (reviewUrl ?? '')}>
            Guardar
          </Button>
        </div>
      </Field>

      {searchAvailable && hasPlace && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-surface p-3.5">
          <p className="min-w-0 flex-1 basis-[12rem] text-[14px] leading-snug text-ink">
            Copia a tu agenda el horario que tienes en Google.
          </p>
          <Button variant="secondary" size="sm" onClick={importHours} disabled={pending}>
            <Icon name="clock" className="h-4 w-4" />
            Copiar horario
          </Button>
        </div>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </Section>
  )
}
