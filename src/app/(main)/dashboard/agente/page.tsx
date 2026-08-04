import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentConfigForm } from '@/features/agente-ia/components/agent-config-form'
import { KnowledgeManager } from '@/features/agente-ia/components/knowledge-manager'
import { BusinessTemplatePicker } from '@/features/agente-ia/components/business-template-picker'
import { VoiceForm } from '@/features/agente-ia/components/voice-form'
import { parseVoiceProfile } from '@/features/agente-ia/voice'

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

  // La voz se lee en una consulta APARTE, no en el select de arriba, para que
  // la página no reviente si el código llega a producción antes que la
  // migración 20260805000000 (las columnas voice_* no existirían y el select
  // entero fallaría). Si falla, se trata como "sin voz" y el agente se
  // comporta igual que antes de esta feature — degradación segura, no un gate.
  const { data: voice } = await supabase
    .from('agent_configs')
    .select('voice_preset, voice_profile')
    .maybeSingle()

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
        <VoiceForm
          initialPreset={voice?.voice_preset ?? null}
          initialProfile={parseVoiceProfile(voice?.voice_profile)}
        />
        <KnowledgeManager items={knowledge ?? []} />
      </div>
    </>
  )
}
