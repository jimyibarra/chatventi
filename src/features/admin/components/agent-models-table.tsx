'use client'

import { useState, useTransition } from 'react'
import { setOrgAgentModel } from '../agent-actions'

export type AgentModelRow = {
  org_id: string
  org_name: string
  model: string
  enabled: boolean
}

// Modelos ofrecidos (ids de OpenRouter). Si una org ya usa otro, se añade abajo
// para no perderlo del selector.
const MODEL_OPTIONS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.0-flash-001',
]

function Row({ row }: { row: AgentModelRow }) {
  const [pending, startTransition] = useTransition()
  const [model, setModel] = useState(row.model)
  const [saved, setSaved] = useState<'ok' | 'err' | null>(null)

  const options = MODEL_OPTIONS.includes(model) ? MODEL_OPTIONS : [model, ...MODEL_OPTIONS]
  const dirty = model !== row.model

  function save() {
    setSaved(null)
    startTransition(async () => {
      const res = await setOrgAgentModel(row.org_id, model)
      setSaved(res.ok ? 'ok' : 'err')
    })
  }

  return (
    <tr className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/60">
      <td className="px-4 py-3">
        <p className="font-semibold text-white">{row.org_name}</p>
        <p className="text-xs text-slate-400">{row.enabled ? 'Agente activo' : 'Agente inactivo'}</p>
      </td>
      <td className="px-4 py-3">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved === 'ok' && <span className="ml-2 text-xs text-emerald-400">✓</span>}
        {saved === 'err' && <span className="ml-2 text-xs text-rose-400">error</span>}
      </td>
    </tr>
  )
}

export function AgentModelsTable({ rows }: { rows: AgentModelRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 font-medium">Negocio</th>
            <th className="px-4 py-3 font-medium">Modelo del agente</th>
            <th className="px-4 py-3 text-right font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.org_id} row={r} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                No hay organizaciones.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
