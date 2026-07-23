'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importClients, type ImportResult } from '../import-actions'

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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        data-testid="crm-import"
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface disabled:opacity-50"
      >
        {pending ? 'Importando…' : '⬆ Importar CSV'}
      </button>

      {result && (
        <div
          className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-white p-3 text-xs shadow-lg"
          data-testid="crm-import-result"
        >
          {result.ok ? (
            <>
              <p className="font-medium text-ink">Importación lista</p>
              <p className="mt-1 text-ink-muted">
                {result.inserted} nuevos · {result.updated} actualizados
                {result.invalid > 0 ? ` · ${result.invalid} inválidos` : ''}
              </p>
            </>
          ) : (
            <p className="text-rose-600">{result.error}</p>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-2 text-ink-faint hover:text-ink"
          >
            Cerrar
          </button>
        </div>
      )}
      <p className="mt-1 text-[11px] text-ink-faint">CSV: nombre, teléfono</p>
    </div>
  )
}
