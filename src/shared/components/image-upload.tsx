'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MEDIA_BUCKET = 'media'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB (coincide con el tope del bucket)
const ACCEPT = 'image/png,image/jpeg,image/webp'
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Subida de imagen desde el dispositivo (PC o celular) a Supabase Storage,
// aislada por org (ruta "<orgId>/<folder>/<uuid>.<ext>"). Reutilizable para
// logo, productos y profesionales. NO guarda en la BD: reporta la URL pública
// a `onChange`, que la persiste (y borra la imagen anterior en el servidor).
export function ImageUpload({
  orgId,
  folder,
  currentUrl,
  onChange,
  shape = 'square',
  hint,
  label = 'Subir imagen',
}: {
  orgId: string
  folder: 'logo' | 'products' | 'resources'
  currentUrl: string | null
  // Devuelve true si la persistencia fue OK (para reflejar el cambio en el UI).
  onChange: (url: string | null) => Promise<boolean>
  shape?: 'square' | 'round'
  hint?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(currentUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File) {
    setError(null)
    if (!EXT[file.type]) {
      setError('Formato no válido. Sube PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen pesa más de 5 MB. Usa una más ligera.')
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const path = `${orgId}/${folder}/${crypto.randomUUID()}.${EXT[file.type]}`
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        setError('No se pudo subir la imagen. Intenta de nuevo.')
        setBusy(false)
        return
      }
      const publicUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
      const ok = await onChange(publicUrl)
      if (ok) setUrl(publicUrl)
      else setError('Se subió la imagen pero no se pudo guardar. Intenta de nuevo.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setError(null)
    setBusy(true)
    try {
      const ok = await onChange(null)
      if (ok) setUrl(null)
      else setError('No se pudo quitar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  const box = shape === 'round' ? 'rounded-full' : 'rounded-xl'

  return (
    <div className="flex items-start gap-3">
      <div
        className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-line bg-surface ${box}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl text-ink-faint" aria-hidden>
            🖼️
          </span>
        )}
      </div>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? 'Subiendo…' : url ? 'Cambiar' : label}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-surface"
            >
              Quitar
            </button>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
