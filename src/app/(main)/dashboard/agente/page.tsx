import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentConfigForm } from '@/features/agente-ia/components/agent-config-form'
import { KnowledgeManager } from '@/features/agente-ia/components/knowledge-manager'
import { BusinessTemplatePicker } from '@/features/agente-ia/components/business-template-picker'

export const dynamic = 'force-dynamic'

export default async function AgentePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: config }, { data: knowledge }, { data: org }] = await Promise.all([
    supabase
      .from('agent_configs')
      .select('enabled, approval_mode, approval_telegram_chat_id, system_prompt')
      .maybeSingle(),
    supabase.from('knowledge_base').select('id, content, source').order('created_at', { ascending: false }),
    supabase.from('organizations').select('name, business_type').maybeSingle(),
  ])

  // Sugerencia de rubro para cuentas ANTIGUAS: hasta el alta en dos pasos
  // (2026-08-04) el rubro se elegía en el registro y se quedaba en los
  // metadatos sin persistirse nunca. Las cuentas nuevas ya traen
  // organizations.business_type desde /bienvenida, así que este respaldo solo
  // sirve a las de antes; puede retirarse cuando ya no queden.
  const suggestedType =
    ((user?.user_metadata ?? {}) as { pending_business_type?: string }).pending_business_type ?? null
  const hasCustomPrompt = !!config?.system_prompt?.trim()

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

        <BusinessTemplatePicker
          orgName={org?.name ?? 'tu negocio'}
          currentBusinessType={org?.business_type ?? null}
          suggestedType={suggestedType}
          hasCustomPrompt={hasCustomPrompt}
        />
        <AgentConfigForm config={config ?? null} />
        <KnowledgeManager items={knowledge ?? []} />
      </div>
    </>
  )
}
