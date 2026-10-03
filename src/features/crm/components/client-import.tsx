'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importClients, type ImportResult } from '../import-actions'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

// Parseo mínimo de CSV: soporta comillas dobles y comas dentro de comillas.
// Suficiente para un export de contactos (nombre, teléfono). Detecta las
// columnas "nombre" y "teléfono" por su encabezado; si no hay encabezado
// reconocible, asume [nombre, teléfono].
function parseCsv(text: string): { name?: string; phone: string }[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (field !== '' || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
      if (ch === '\r' && text[i + 1] === '\n') i++
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  if (rows.length === 0) return []

  // ¿La primera fila es un encabezado? Busca "nombre"/"name" y "tel"/"phone".
  // Quita acentos con reemplazos precompuestos (sin combining marks).
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u')
  const head = rows[0].map(norm)
  const nameIdx = head.findIndex((h) => h.includes('nombre') || h.includes('name'))
  const phoneIdx = head.findIndex(
    (h) => h.includes('telefono') || h.includes('phone') || h.includes('whatsapp') || h.includes('celular')
  )
  const hasHeader = nameIdx !== -1 || phoneIdx !== -1

  const ni = nameIdx !== -1 ? nameIdx : 0
  const pi = phoneIdx !== -1 ? phoneIdx : 1
  const body = hasHeader ? rows.slice(1) : rows

  return body
    .map((r) => ({ name: (r[ni] ?? '').trim(), phone: (r[pi] ?? '').trim() }))
    .filter((r) => r.phone) // sin teléfono no hay a quién importar
}

export function ClientImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)

  function onFile(file: File) {
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ''))
      if (rows.length === 0) {
        setResult({ ok: false, error: 'No se encontraron filas con teléfono en el archivo.' })
        return
      }
      startTransition(async () => {
        const res = await importClients(rows)
        setResult(res)
        if (res.ok) router.refresh()
      })
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        data-testid="crm-import"
        title="Archivo CSV con dos columnas: nombre y teléfono"
      >
        <Icon name="upload" />
        {pending ? 'Importando…' : 'Importar CSV'}
      </Button>

      {result && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[16px] bg-white p-4 text-sm shadow-[0_1px_0_#dde2f0,0_18px_40px_-16px_rgba(42,26,94,.4)]"
          data-testid="crm-import-result"
          role="status"
        >
          {result.ok ? (
            <>
              <p className="flex items-center gap-2 font-bold text-ink">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0d9463] text-white" aria-hidden>
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                Importación lista
              </p>
              <p className="mt-1.5 tabular-nums text-ink-muted">
                {result.inserted.toLocaleString('en-US')} nuevos · {result.updated.toLocaleString('en-US')} actualizados
                {result.invalid > 0 ? ` · ${result.invalid.toLocaleString('en-US')} inválidos` : ''}
              </p>
            </>
          ) : (
            <p className="text-[#a51b18]">{result.error}</p>
          )}
          <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="-ml-2 mt-2">
            Cerrar
          </Button>
        </div>
      )}
      {/* Fuera del flujo: no descuadra la fila de acciones de la cabecera. */}
      {!result && (
        <p className="absolute inset-x-0 top-full mt-0.5 whitespace-nowrap text-center text-[12px] text-ink-muted">
          CSV: nombre, teléfono
        </p>
      )}
    </div>
  )
}
