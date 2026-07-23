'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addClientFile, deleteClientFile, getClientFileUrl } from '../actions'
import type { ClientFile } from '../types'

const RECORDS_BUCKET = 'records'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB (coincide con el tope del bucket)
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'
const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

/**
 * Archivos del expediente. El bucket `records` es PRIVADO: aquí solo se guardan
 * rutas, nunca URLs. El enlace se firma al hacer clic (caduca en minutos), así
 * que un enlace copiado no sigue sirviendo indefinidamente.
 */
export function ClientFiles({
  clientId,
  orgId,
  files,
}: {
  clientId: string
  orgId: string
  files: ClientFile[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  async function upload(file: File) {
    setError(null)
    if (!EXT[file.type]) {
      setError('Formato no válido. Sube PDF, PNG o JPG.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 10 MB.')
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const path = `${orgId}/clients/${clientId}/${crypto.randomUUID()}.${EXT[file.type]}`
      const { error: upErr } = await supabase.storage
        .from(RECORDS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        setError('No se pudo subir el archivo. Intenta de nuevo.')
        return
      }
      const res = await addClientFile({
        clientId,
        path,
        fileName: file.name.slice(0, 200),
        mimeType: file.type,
        sizeBytes: file.size,
        note: note.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setNote('')
      router.refresh()
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function open(id: string) {
    startTransition(async () => {
      const res = await getClientFileUrl(id)
      if ('url' in res) window.open(res.url, '_blank', 'noopener,noreferrer')
      else setError(res.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteClientFile(id, clientId)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-ink">Archivos del cliente</h2>
      <p className="mb-3 mt-1 text-sm text-ink-faint">
        Radiografías, consentimientos, recetas, fotos de antes y después. Solo tu equipo puede
        verlos: los enlaces son temporales.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Descripción (opcional): radiografía panorámica, consentimiento…"
          data-testid="file-note"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          data-testid="file-upload"
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Subiendo…' : 'Subir archivo'}
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-faint">PDF, PNG o JPG. Máximo 10 MB.</p>

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-ink-faint">Sin archivos todavía.</p>
      ) : (
        <ul className="divide-y divide-line-row">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {f.mime_type === 'application/pdf' ? '📄' : '🖼️'} {f.file_name}
                </p>
                <p className="text-xs text-ink-faint">
                  {dateLabel(f.created_at)} · {sizeLabel(f.size_bytes)}
                  {f.note ? ` · ${f.note}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => open(f.id)}
                  disabled={pending}
                  data-testid="file-open"
                  className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface disabled:opacity-50"
                >
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={pending}
                  className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-rose-600 hover:bg-surface disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
