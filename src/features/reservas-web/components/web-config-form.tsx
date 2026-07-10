'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveWebConfig } from '../actions'

const BASE = 'https://www.chatventi.com'

type Branding = {
  primary_color?: string
  description?: string
  logo_url?: string
  whatsapp_number?: string
} | null

export function WebConfigForm({
  webSlug,
  branding,
}: {
  webSlug: string | null
  branding: Branding
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [slug, setSlug] = useState(webSlug ?? '')
  const [color, setColor] = useState(branding?.primary_color ?? '#2563eb')
  const [description, setDescription] = useState(branding?.description ?? '')
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url ?? '')
  const [whatsappNumber, setWhatsappNumber] = useState(branding?.whatsapp_number ?? '')
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
        logoUrl: logoUrl || undefined,
        whatsappNumber: whatsappNumber || undefined,
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

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Tu página de reservas</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Enlace (slug)</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-400">{BASE}/r/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              data-testid="web-slug"
              placeholder="mi-negocio"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Color principal</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded border border-gray-300"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                data-testid="web-color"
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">URL del logo</label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            WhatsApp del negocio (para pedidos de productos)
          </label>
          <input
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            data-testid="web-whatsapp"
            placeholder="5215512345678 (solo dígitos, con lada del país)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Si lo configuras, cada producto de tu página mostrará un botón “Pedir por WhatsApp”.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Descripción corta</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="web-description"
            placeholder="Ej: Barbería clásica en el centro"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
            data-testid="web-msg"
          >
            {msg.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={pending}
            data-testid="save-web"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {publicUrl && (
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div>
              <p className="text-xs font-medium text-gray-500">Enlace público</p>
              <div className="flex items-center gap-2">
                <a href={publicUrl} target="_blank" rel="noopener" className="truncate text-sm text-brand-600 hover:underline">
                  {publicUrl}
                </a>
                <button onClick={() => copy(publicUrl, 'url')} className="text-xs text-gray-500 hover:text-gray-800">
                  {copied === 'url' ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Widget para tu sitio web</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-gray-700">
                  {widgetSnippet}
                </code>
                <button onClick={() => copy(widgetSnippet!, 'widget')} className="text-xs text-gray-500 hover:text-gray-800">
                  {copied === 'widget' ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
