'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/shared/components/image-upload'
import { saveWebConfig, saveLogo } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'

const BASE = 'https://www.chatventi.com'

type Branding = {
  primary_color?: string
  description?: string
  logo_url?: string
} | null

export function WebConfigForm({
  orgId,
  webSlug,
  branding,
  siteUrl = null,
  partnerName = null,
}: {
  orgId: string
  webSlug: string | null
  branding: Branding
  /** Página web del negocio (la del socio o la propia). Con ella, el widget manda. */
  siteUrl?: string | null
  /** Socio interno que hizo esa página (PASEN): ya trae el botón de reservar. */
  partnerName?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [slug, setSlug] = useState(webSlug ?? '')
  const [color, setColor] = useState(branding?.primary_color ?? '#2563eb')
  const [description, setDescription] = useState(branding?.description ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const publicUrl = webSlug ? `${BASE}/r/${webSlug}` : null
  const widgetSnippet = webSlug
    ? `<script src="${BASE}/widget.js" data-slug="${webSlug}" async></script>`
    : null

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveWebConfig({
        slug,
        primaryColor: color || undefined,
        description: description || undefined,
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'Guardado. Tu página pública está lista.' })
        router.refresh()
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  function copy(text: string, which: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  // Un color mal escrito no debe romper la vista previa.
  const swatch = /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#2563eb'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Section title="Tu agenda en línea" description="Lo que ven tus clientes al reservar: tu color, tu logo y una frase sobre tu negocio. El enlace es la dirección de la agenda; también la usa el botón de tu página web.">
        <div className="space-y-4">
          <Field label="Enlace" hint="De 3 a 40 caracteres: minúsculas, números y guiones. Es la dirección que compartirás.">
            <span className="flex min-h-[44px] items-stretch overflow-hidden rounded-[13px] border-2 border-[#d6dbec] bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 hover:border-[#bfc5dd] md:min-h-[40px]">
              <span className="flex items-center bg-surface px-3 text-[14px] text-ink-muted">chatventi.com/r/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                data-testid="web-slug"
                placeholder="mi-negocio"
                className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
            </span>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field as="div" label="Color principal">
              <div className="flex items-center gap-2">
                <label className="relative grid h-11 w-11 flex-none cursor-pointer place-items-center overflow-hidden rounded-[13px] shadow-[inset_0_0_0_2px_#d6dbec] md:h-10 md:w-10" title="Elegir color">
                  <span className="sr-only">Elegir color</span>
                  <span className="h-6 w-6 rounded-full" style={{ background: swatch }} aria-hidden />
                  <input type="color" value={swatch} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
                <span className="w-32">
                  <Input
                    aria-label="Color en hexadecimal"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    data-testid="web-color"
                    className="font-mono uppercase"
                  />
                </span>
              </div>
            </Field>
            <Field as="div" label="Logo del negocio">
              <ImageUpload
                orgId={orgId}
                folder="logo"
                currentUrl={branding?.logo_url ?? null}
                shape="square"
                label="Subir logo"
                hint="PNG o JPG, cuadrado (mín. 200×200 px), fondo claro. Máx 5 MB."
                onChange={async (url) => (await saveLogo(url)).ok}
              />
            </Field>
          </div>

          <Field label="Descripción corta">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="web-description"
              placeholder="Ej: Barbería clásica en el centro"
            />
          </Field>

          {msg && (
            <Notice tone={msg.ok ? 'success' : 'danger'} size="sm" testId="web-msg">
              {msg.text}
            </Notice>
          )}

          <div className="flex justify-end border-t border-line pt-4">
            <Button onClick={save} disabled={pending} data-testid="save-web">
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Section>

      <div className="min-w-0 space-y-4">
        {/* Vista previa en vivo: lo que el cliente ve arriba de su reserva. */}
        <Section title="Así se ve">
          <div className="overflow-hidden rounded-[16px] bg-surface">
            <div className="h-16" style={{ background: swatch }} aria-hidden />
            <div className="-mt-8 px-4 pb-4">
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-[16px] bg-white shadow-[0_2px_8px_rgba(42,26,94,.18)]">
                {branding?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="image" className="h-6 w-6 text-ink-faint" />
                )}
              </span>
              <p className="mt-2.5 text-[14.5px] leading-snug text-ink">
                {description || <span className="text-ink-muted">Aquí va tu descripción corta.</span>}
              </p>
              <span
                className="mt-3 inline-flex min-h-[40px] items-center rounded-[12px] px-4 text-[14px] font-semibold text-white"
                style={{ background: swatch }}
              >
                Reservar cita
              </span>
            </div>
          </div>
        </Section>

        {publicUrl ? (
          <>
            {/* Primero la página web del negocio (ahí se queda la visita); el enlace suelto es el plan B. */}
            <Section title="Reservar desde tu página web" data-testid="web-site">
              {siteUrl ? (
                <p className="text-[14.5px] leading-relaxed text-ink">
                  Tus clientes reservan en{' '}
                  <a href={siteUrl} target="_blank" rel="noopener" className="font-semibold text-brand-700 underline-offset-2 hover:underline">{siteUrl}</a>
                  {partnerName ? `. La hizo ${partnerName} y ya trae el botón «Reservar cita» conectado a esta agenda.` : ', con el botón «Reservar cita» de abajo.'}
                </p>
              ) : (
                <p className="text-[14.5px] leading-relaxed text-ink-muted">
                  Si tienes página web, pega este código y aparece un botón «Reservar cita» que abre tu agenda sin que el cliente salga de tu página.
                </p>
              )}
              {(!siteUrl || !partnerName) && (
                <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-surface py-1.5 pl-3.5 pr-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-muted">{widgetSnippet}</code>
                  <Button variant="ghost" size="sm" onClick={() => copy(widgetSnippet!, 'widget')}>
                    <Icon name={copied === 'widget' ? 'check' : 'copy'} className="h-4 w-4" />
                    {copied === 'widget' ? '¡Copiado!' : 'Copiar'}
                  </Button>
                </div>
              )}
            </Section>
            <Section title="Enlace para Instagram y Google" data-testid="web-link">
              {siteUrl ? (
                <p className="text-[14.5px] leading-relaxed text-ink-muted">
                  Pon tu página en tu biografía de Instagram y en tu ficha de Google: <span className="font-semibold text-ink">{siteUrl}</span>. Ahí mismo reservan.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-[14.5px] leading-relaxed text-ink-muted">
                    Solo si no tienes página web: este enlace abre tu agenda sola. Ponlo en tu biografía de Instagram y en tu ficha de Google.
                  </p>
                  <div className="flex items-center gap-2 rounded-[13px] bg-surface py-1.5 pl-3.5 pr-1.5">
                    <a href={publicUrl} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-[14px] font-semibold text-brand-700 underline-offset-2 hover:underline">
                      {publicUrl}
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => copy(publicUrl, 'url')}>
                      <Icon name={copied === 'url' ? 'check' : 'copy'} className="h-4 w-4" />
                      {copied === 'url' ? '¡Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                </>
              )}
            </Section>
          </>
        ) : (
          <Notice tone="info" title="Aún no está publicada">
            Elige tu enlace y guarda: aquí aparecerán el botón para tu página web y el enlace para Instagram y Google.
          </Notice>
        )}
      </div>
    </div>
  )
}
