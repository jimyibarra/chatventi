import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProbarChat } from '@/features/agente-ia/components/probar-chat'

export const dynamic = 'force-dynamic'

type Service = { name: string; price: number | null; duration_minutes: number | null }

export default async function ProbarAgentePage() {
  const supabase = await createClient()

  const [{ data: org }, { data: config }, { data: services }, { data: knowledge }, { data: resources }] =
    await Promise.all([
      supabase.from('organizations').select('name, branding').maybeSingle(),
      supabase.from('agent_configs').select('enabled').maybeSingle(),
      supabase
        .from('service_catalogs')
        .select('name, price, duration_minutes')
        .eq('active', true)
        .order('name'),
      supabase.from('knowledge_base').select('content').order('created_at'),
      supabase.from('resources').select('name').eq('active', true).order('sort_order').order('name'),
    ])

  const businessName = org?.name ?? 'tu negocio'
  const agentEnabled = config?.enabled ?? false
  const svc = (services as Service[] | null) ?? []
  const kb = ((knowledge as { content: string }[] | null) ?? []).map((k) => k.content)
  const team = ((resources as { name: string }[] | null) ?? []).map((r) => r.name)
  const resourceLabel =
    (org?.branding as { resource_label?: string } | null)?.resource_label ?? 'Profesionales'

  const money = (n: number | null) => (n != null ? `$${n}` : '—')

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Cabecera */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/agente" className="text-sm text-ink-soft hover:underline">
              ← Recepcionista IA
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-bold text-ink">Prueba el Chat IA en vivo</h1>
          <p className="text-sm text-ink-soft">
            Chatea con tu recepcionista igual que lo harán tus clientes por WhatsApp. Usa la misma
            IA y la información real de tu negocio. Las reservas aquí son de práctica: no se crean
            citas reales.
          </p>
        </div>
        <Link
          href="/dashboard/agente"
          className="shrink-0 rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface"
        >
          Configurar Chat IA
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Chat */}
        <div>
          <ProbarChat
            businessName={businessName}
            agentEnabled={agentEnabled}
            services={svc.map((s) => ({ name: s.name, price: s.price }))}
          />
        </div>

        {/* Panel: lo que la IA tiene disponible */}
        <aside className="space-y-4">
          <section className="rounded-card border border-line bg-white p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
              💡 Prueba a preguntar
            </h2>
            <ol className="ml-4 list-decimal space-y-1 text-[13px] text-ink-soft">
              <li>&quot;Quiero una cita para mañana&quot;</li>
              <li>&quot;¿Qué servicios ofrecen?&quot;</li>
              <li>&quot;¿Cuál es su horario?&quot;</li>
              <li>&quot;Algo que no esté en tu información&quot; (para ver los límites)</li>
            </ol>
          </section>

          <section className="rounded-card border border-line bg-white p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              🗂️ Información que usa la IA
            </h2>
            <p className="mb-3 text-[13px] text-ink-soft">
              Esto es lo que tu recepcionista tiene disponible para responder. Edítalo desde cada
              sección del panel.
            </p>

            <details className="group border-t border-line-row py-2" open>
              <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-muted">
                Servicios y precios ({svc.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[12.5px] text-ink-soft">
                {svc.length === 0 && <li className="text-ink-faint">Sin servicios configurados.</li>}
                {svc.map((s) => (
                  <li key={s.name} className="flex justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="shrink-0 text-ink-muted">
                      {money(s.price)}
                      {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            <details className="group border-t border-line-row py-2">
              <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-muted">
                {resourceLabel} ({team.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[12.5px] text-ink-soft">
                {team.length === 0 && (
                  <li className="text-ink-faint">Sin {resourceLabel.toLowerCase()} configurados.</li>
                )}
                {team.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>

            <details className="group border-t border-line-row py-2">
              <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-muted">
                Base de conocimiento ({kb.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[12.5px] text-ink-soft">
                {kb.length === 0 && (
                  <li className="text-ink-faint">
                    Aún no cargas información.{' '}
                    <Link href="/dashboard/agente" className="text-brand-600 hover:underline">
                      Agregar
                    </Link>
                  </li>
                )}
                {kb.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
          </section>

          <section className="rounded-card border border-line bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-ink">¿Cómo funciona?</h2>
            <p className="text-[13px] text-ink-soft">
              Este chat usa exactamente la misma IA que recibirán tus clientes por WhatsApp y
              Telegram. Puede agendar, responder dudas y escalar a una persona — todo automático.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
