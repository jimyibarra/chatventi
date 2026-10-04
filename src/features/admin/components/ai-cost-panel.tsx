import { AI_TURN_COST_USD, EXTRA_REPLY_PRICE_USD } from '@/features/billing/plans'
import { AdminTable, NUM, STICKY, TD, TH, TR } from './admin-table'
import { KpiCell, SEGMENT_GROUP, SegmentLink, StatusChip, type ChipTone } from '@/shared/components/ui'
import { fmtInt } from '@/shared/lib/format'

// Costo REAL de la IA (lo que cobra OpenRouter) contra el estimado con el que
// se fijaron los planes. Lo ve solo el superadmin: es el costo de ChatVenti.

export type AiCostRow = {
  organization_id: string | null
  name: string | null
  source: 'agente' | 'prueba' | 'superpoderes' | 'ventas'
  /** Respuestas o tareas medidas (una por registro). */
  requests: number
  calls: number
  calls_without_cost: number
  tokens_in: number
  tokens_out: number
  cost_usd: number
}

type OrgCost = {
  key: string
  name: string
  /** Respuestas a clientes MEDIDAS (agente + ventas): las que tienen su costo registrado. */
  replies: number
  calls: number
  withoutCost: number
  tokens: number
  /** Lo que gastaron las respuestas a clientes (agente + ventas): lo comparable con lo cobrado. */
  replyCost: number
  /** «Prueba el chat» y superpoderes: gasto que no se cobra por respuesta. */
  otherCost: number
}

/** Dólares con la precisión que piden montos de centavos: $0.00142, $0.0213, $12.40. */
function usd(n: number): string {
  const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : 5
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: n === 0 ? 2 : digits, maximumFractionDigits: digits })}`
}

function byOrg(rows: AiCostRow[]): OrgCost[] {
  const map = new Map<string, OrgCost>()
  for (const r of rows) {
    const key = r.organization_id ?? 'publica'
    const o = map.get(key) ?? {
      key,
      name: r.organization_id ? (r.name ?? 'Negocio eliminado') : 'Página pública de ChatVenti',
      replies: 0,
      calls: 0,
      withoutCost: 0,
      tokens: 0,
      replyCost: 0,
      otherCost: 0,
    }
    o.calls += r.calls
    o.withoutCost += r.calls_without_cost
    o.tokens += Number(r.tokens_in) + Number(r.tokens_out)
    if (r.source === 'agente' || r.source === 'ventas') {
      o.replyCost += Number(r.cost_usd)
      o.replies += r.requests
    } else o.otherCost += Number(r.cost_usd)
    map.set(key, o)
  }
  return [...map.values()].sort((a, b) => b.replyCost + b.otherCost - (a.replyCost + a.otherCost))
}

/** Costo por respuesta contra el estimado: dentro, por encima, o tan alto que el excedente se vende con pérdida. */
function verdict(perReply: number): { tone: ChipTone; label: string } {
  if (perReply <= AI_TURN_COST_USD) return { tone: 'ok', label: 'Dentro de lo estimado' }
  const pct = Math.round((perReply / AI_TURN_COST_USD - 1) * 100)
  if (perReply <= EXTRA_REPLY_PRICE_USD) return { tone: 'wait', label: `${pct} % sobre lo estimado` }
  return { tone: 'noshow', label: `${pct} % arriba: el excedente pierde` }
}

export function AiCostPanel({ rows, monthLabel, previous }: { rows: AiCostRow[]; monthLabel: string; previous: boolean }) {
  const orgs = byOrg(rows)
  const total = orgs.reduce((s, o) => s + o.replyCost + o.otherCost, 0)
  const replyCost = orgs.reduce((s, o) => s + o.replyCost, 0)
  const replies = orgs.reduce((s, o) => s + o.replies, 0)
  const withoutCost = orgs.reduce((s, o) => s + o.withoutCost, 0)
  const perReply = replies > 0 ? replyCost / replies : null
  const overall = perReply === null ? null : verdict(perReply)

  return (
    <section aria-labelledby="costo-ia" className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="costo-ia" className="text-[1.15rem] font-bold leading-tight text-ink">
            Costo real de la IA · {monthLabel}
          </h2>
          <p className="mt-1 max-w-[70ch] text-[14px] text-ink-muted">
            Lo que cobró OpenRouter, medido en cada llamada. Se compara con el estimado de los planes:{' '}
            {usd(AI_TURN_COST_USD)} USD por respuesta (el excedente se vende a {usd(EXTRA_REPLY_PRICE_USD)}).
          </p>
        </div>
        <nav className={SEGMENT_GROUP} aria-label="Mes">
          <SegmentLink href="/admin/agente" active={!previous}>
            Este mes
          </SegmentLink>
          <SegmentLink href="/admin/agente?mes=anterior" active={previous}>
            Mes anterior
          </SegmentLink>
        </nav>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCell label="Costo total" value={usd(total)} unit="USD" hint="Respuestas, pruebas y superpoderes" testId="ai-cost-total" />
        <KpiCell label="Respuestas medidas" value={fmtInt(replies)} hint="Respuestas a clientes con su costo registrado" />
        <KpiCell
          label="Costo por respuesta"
          value={perReply === null ? '—' : usd(perReply)}
          unit={perReply === null ? undefined : 'USD'}
          hint={overall ? <StatusChip tone={overall.tone}>{overall.label}</StatusChip> : 'Aún sin respuestas este mes'}
          testId="ai-cost-per-reply"
          // En celular, a lo ancho: el veredicto no cabe en media columna.
          className="col-span-2 md:col-span-1"
        />
        <KpiCell
          label="Llamadas sin costo reportado"
          value={fmtInt(withoutCost)}
          hint={withoutCost > 0 ? 'OpenRouter no devolvió el costo: el total se queda corto' : 'Todas las llamadas traen su costo'}
          tone={withoutCost > 0 ? 'danger' : 'plain'}
          className="col-span-2 md:col-span-1"
        />
      </dl>

      {orgs.length === 0 ? (
        <p className="rounded-[16px] bg-white px-4 py-3 text-[14.5px] text-ink-muted shadow-[0_1px_0_#dde2f0]">
          Todavía no hay llamadas medidas en {monthLabel}. Aparecerán aquí desde la primera respuesta de la recepcionista.
        </p>
      ) : (
        <AdminTable label={`Costo de la IA por negocio, ${monthLabel}`} minWidth={820}>
          <thead>
            <tr>
              <th scope="col" className={`${TH} ${STICKY}`}>Negocio</th>
              <th scope="col" className={`${TH} ${NUM}`}>Respuestas</th>
              <th scope="col" className={`${TH} ${NUM}`}>Llamadas</th>
              <th scope="col" className={`${TH} ${NUM}`}>Tokens</th>
              <th scope="col" className={`${TH} ${NUM}`}>Costo respuestas</th>
              <th scope="col" className={`${TH} ${NUM}`}>Pruebas y superpoderes</th>
              <th scope="col" className={TH}>Por respuesta</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => {
              const per = o.replies > 0 ? o.replyCost / o.replies : null
              const v = per === null ? null : verdict(per)
              return (
                <tr key={o.key} className={TR} data-testid="ai-cost-row">
                  <th scope="row" className={`${TD} ${STICKY} max-w-[15rem] text-left font-semibold`}>
                    <span className="block truncate">{o.name}</span>
                  </th>
                  <td className={`${TD} ${NUM}`}>{fmtInt(o.replies)}</td>
                  <td className={`${TD} ${NUM}`}>{fmtInt(o.calls)}</td>
                  <td className={`${TD} ${NUM}`}>{fmtInt(o.tokens)}</td>
                  <td className={`${TD} ${NUM} font-semibold`}>{usd(o.replyCost)}</td>
                  <td className={`${TD} ${NUM} text-ink-muted`}>{usd(o.otherCost)}</td>
                  <td className={TD}>
                    {per === null || !v ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                        <span className="tabular-nums">{usd(per)}</span>
                        <StatusChip tone={v.tone}>{v.label}</StatusChip>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      )}
    </section>
  )
}
