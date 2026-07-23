import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AgentModelsTable, type AgentModelRow } from '@/features/admin/components/agent-models-table'

export const metadata: Metadata = { title: 'Super Admin · Agente IA' }
export const dynamic = 'force-dynamic'

export default async function AdminAgentePage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_list_agent_models')
  const rows = (data ?? []) as AgentModelRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Agente IA · Modelo</h1>
        <p className="mt-1 text-sm text-slate-400">
          El modelo de cada agente lo administra el sistema (no el dueño). Ajústalo aquí por
          organización. Los ids son de OpenRouter.
        </p>
      </div>
      <AgentModelsTable rows={rows} />
    </div>
  )
}
