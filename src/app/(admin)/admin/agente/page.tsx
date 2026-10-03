import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AgentModelsTable, type AgentModelRow } from '@/features/admin/components/agent-models-table'
import { Page, PageHeader } from '@/shared/components/ui'

export const metadata: Metadata = { title: 'Super Admin · Agente IA' }
export const dynamic = 'force-dynamic'

export default async function AdminAgentePage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_list_agent_models')
  const rows = (data ?? []) as AgentModelRow[]

  return (
    <Page>
      <PageHeader
        title="Modelo del agente IA"
        subtitle="El modelo de cada agente lo administra el sistema, no el dueño. Ajústalo aquí por organización. Los identificadores son los de OpenRouter."
      />
      <AgentModelsTable rows={rows} />
    </Page>
  )
}
