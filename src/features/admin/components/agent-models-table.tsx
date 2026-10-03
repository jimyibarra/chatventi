'use client'

import { useState, useTransition } from 'react'
import { setOrgAgentModel } from '../agent-actions'
import { AdminTable, STICKY, TD, TH, TR } from './admin-table'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { Select } from '@/shared/components/ui/field'
import { StatusChip } from '@/shared/components/ui/status-chip'

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
  const [errorText, setErrorText] = useState('')

  const options = MODEL_OPTIONS.includes(model) ? MODEL_OPTIONS : [model, ...MODEL_OPTIONS]
  const dirty = model !== row.model

  function save() {
    setSaved(null)
    startTransition(async () => {
      const res = await setOrgAgentModel(row.org_id, model)
      setSaved(res.ok ? 'ok' : 'err')
      setErrorText(res.ok ? '' : res.error)
    })
  }

  return (
    <tr className={TR}>
      <th scope="row" className={`${TD} ${STICKY} max-w-[16rem] text-left font-normal`}>
        <p className="truncate font-semibold">{row.org_name}</p>
        <StatusChip tone={row.enabled ? 'ok' : 'off'} className="mt-1">
          {row.enabled ? 'Agente activo' : 'Agente inactivo'}
        </StatusChip>
      </th>
      <td className={TD}>
        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label={`Modelo del agente de ${row.org_name}`}
          wrapperClassName="min-w-[15rem] max-w-[22rem]"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </td>
      <td className={`${TD} text-right`}>
        <div className="flex items-center justify-end gap-2.5">
          {saved === 'ok' && !dirty && <StatusChip tone="ok">Guardado</StatusChip>}
          {saved === 'err' && (
            <StatusChip tone="noshow" title={errorText}>
              {errorText || 'No se guardó'}
            </StatusChip>
          )}
          {/* Sin cambios, el botón se apaga a «ghost»: ocho botones violeta inactivos hacen ruido. */}
          <Button size="sm" variant={dirty || pending ? 'primary' : 'ghost'} onClick={save} disabled={pending || !dirty}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function AgentModelsTable({ rows }: { rows: AgentModelRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon="robot" title="No hay organizaciones">
        Cada negocio que se registre tendrá aquí su agente, con el modelo que se le asigna por defecto.
      </EmptyState>
    )
  }
  return (
    <AdminTable label="Modelo del agente por organización" minWidth={680}>
      <thead>
        <tr>
          <th scope="col" className={`${TH} ${STICKY}`}>
            Negocio
          </th>
          <th scope="col" className={TH}>
            Modelo del agente
          </th>
          <th scope="col" className={`${TH} text-right`}>
            <span className="sr-only">Acción</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Row key={r.org_id} row={r} />
        ))}
      </tbody>
    </AdminTable>
  )
}
