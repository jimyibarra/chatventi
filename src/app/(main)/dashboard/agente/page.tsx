import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentConfigForm } from '@/features/agente-ia/components/agent-config-form'
import { KnowledgeManager } from '@/features/agente-ia/components/knowledge-manager'

export const dynamic = 'force-dynamic'

export default async function AgentePage() {
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('agent_configs')
    .select('enabled, model, approval_mode, approval_telegram_chat_id, system_prompt')
    .maybeSingle()

  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('id, content, source')
    .order('created_at', { ascending: false })

  return (
    <>
      <nav className="flex gap-4 border-b border-gray-200 bg-white px-6 py-2 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
          Panel
        </Link>
        <Link href="/dashboard/agenda" className="text-gray-500 hover:text-gray-900">
          Agenda
        </Link>
        <Link href="/dashboard/conversaciones" className="text-gray-500 hover:text-gray-900">
          Conversaciones
        </Link>
        <span className="font-medium text-gray-900">Recepcionista IA</span>
      </nav>

      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recepcionista IA</h1>
          <p className="text-sm text-gray-500">
            Configura el agente que atiende WhatsApp y Telegram: agenda citas, responde dudas y
            escala a un humano cuando hace falta.
          </p>
        </div>

        <AgentConfigForm config={config ?? null} />
        <KnowledgeManager items={knowledge ?? []} />
      </div>
    </>
  )
}
