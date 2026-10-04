import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AgentModelsTable, type AgentModelRow } from '@/features/admin/components/agent-models-table'
import { AiCostPanel, type AiCostRow } from '@/features/admin/components/ai-cost-panel'
import { Page, PageHeader } from '@/shared/components/ui'

export const metadata: Metadata = { title: 'Super Admin · Agente IA' }
export const dynamic = 'force-dynamic'

export default async function AdminAgentePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const previous = (await searchParams).mes === 'anterior'
  // Mes en UTC, igual que el contador de respuestas (usage_periods).
  const month = new Date()
  month.setUTCDate(1)
  if (previous) month.setUTCMonth(month.getUTCMonth() - 1)
  const period = month.toISOString().slice(0, 10)
  const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)

  const supabase = await createClient()
  const [{ data }, { data: costs }] = await Promise.all([
    supabase.rpc('admin_list_agent_models'),
    supabase.rpc('admin_ai_costs', { p_period: period }),
  ])
  const rows = (data ?? []) as AgentModelRow[]

  return (
    <Page>
      <PageHeader
        title="Agente IA"
        subtitle="Lo que cuesta la IA de cada negocio y el modelo que usa. El modelo lo administra el sistema, no el dueño; los identificadores son los de OpenRouter."
      />
      <AiCostPanel rows={(costs ?? []) as unknown as AiCostRow[]} monthLabel={monthLabel} previous={previous} />
      <h2 className="mb-2.5 text-[1.15rem] font-bold leading-tight text-ink">Modelo del agente</h2>
      <AgentModelsTable rows={rows} />
    </Page>
  )
}
