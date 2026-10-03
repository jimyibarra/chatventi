'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addClientFile, deleteClientFile, getClientFileUrl } from '../actions'
import type { ClientFile } from '../types'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

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
    <Section
      title="Archivos del cliente"
      description="Radiografías, consentimientos, recetas, fotos de antes y después. Solo tu equipo puede verlos: los enlaces son temporales."
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="min-w-0">
          <span className="sr-only">Descripción del archivo</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Descripción (opcional): radiografía panorámica…"
            data-testid="file-note"
          />
        </label>
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
        <Button onClick={() => inputRef.current?.click()} disabled={busy} data-testid="file-upload">
          <Icon name="upload" />
          {busy ? 'Subiendo…' : 'Subir archivo'}
        </Button>
      </div>
      <p className="mb-4 mt-1.5 text-[13px] text-ink-muted">PDF, PNG o JPG. Máximo 10 MB.</p>

      {error && <p className="mb-3 text-sm text-[#a51b18]" role="alert">{error}</p>}

      {files.length === 0 ? (
        <p className="text-[14.5px] text-ink-muted">Sin archivos todavía.</p>
      ) : (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-brand-50 text-brand-600" aria-hidden>
                <Icon name={f.mime_type === 'application/pdf' ? 'file' : 'image'} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 basis-[12rem]">
                <p className="truncate text-[15px] font-semibold text-ink">{f.file_name}</p>
                <p className="text-[13px] text-ink-muted">
                  <span className="tabular-nums">
                    {dateLabel(f.created_at)} · {sizeLabel(f.size_bytes)}
                  </span>
                  {f.note ? ` · ${f.note}` : ''}
                </p>
              </div>
              <div className="ml-auto flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => open(f.id)} disabled={pending} data-testid="file-open">
                  <Icon name="external" className="h-4 w-4" />
                  Abrir
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(f.id)} disabled={pending} aria-label="Eliminar archivo">
                  <Icon name="trash" className="h-4 w-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
