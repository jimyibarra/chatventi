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
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Recepcionista IA</h1>
            <p className="text-sm text-ink-soft">
              Configura el agente que atiende WhatsApp y Telegram: agenda citas, responde dudas y
              escala a un humano cuando hace falta.
            </p>
          </div>
          <Link
            href="/dashboard/agente/probar"
            className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600"
          >
            Probar Chat IA →
          </Link>
        </div>

        <AgentConfigForm config={config ?? null} />
        <KnowledgeManager items={knowledge ?? []} />
      </div>
    </>
  )
}
