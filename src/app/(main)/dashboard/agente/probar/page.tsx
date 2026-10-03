import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProbarChat } from '@/features/agente-ia/components/probar-chat'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { ButtonLink } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { fmtMoney } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

type Service = { name: string; price: number | null; duration_minutes: number | null }

/** Grupo plegable del panel lateral: «Servicios y precios (4)». */
function InfoGroup({
  title,
  count,
  open,
  children,
}: {
  title: string
  count: number
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details className="group border-t border-line first:border-t-0" open={open}>
      <summary className="flex min-h-[48px] cursor-pointer items-center gap-2 text-[14.5px] font-semibold text-ink">
        {title}
        <span className="rounded-full bg-surface px-2 text-[12.5px] font-bold tabular-nums text-ink-muted">{count}</span>
        <Icon name="chevronDown" className="cv-chevron ml-auto h-4 w-4 text-ink-muted" />
      </summary>
      <ul className="space-y-1.5 pb-3.5 text-[14px] text-ink-muted">{children}</ul>
    </details>
  )
}

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

  const money = (n: number | null) => (n != null ? fmtMoney(Number(n)) : '—')

  return (
    <Page width="wide">
      <PageHeader
        back={{ href: '/dashboard/agente', label: 'Recepcionista IA' }}
        title="Prueba el Chat IA en vivo"
        subtitle="Chatea con tu recepcionista igual que lo harán tus clientes por WhatsApp. Usa la misma IA y la información real de tu negocio. Las reservas aquí son de práctica: no se crean citas reales."
        actions={
          <ButtonLink href="/dashboard/agente" variant="secondary">
            <Icon name="settings" />
            Configurar Chat IA
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ProbarChat
          businessName={businessName}
          agentEnabled={agentEnabled}
          services={svc.map((s) => ({ name: s.name, price: s.price }))}
        />

        {/* Lo que la IA tiene a mano para responder */}
        <aside className="min-w-0 space-y-4">
          <Section title="Prueba a preguntar">
            <ol className="space-y-2 text-[14.5px] text-ink">
              {[
                '«Quiero una cita para mañana»',
                '«¿Qué servicios ofrecen?»',
                '«¿Cuál es su horario?»',
                'Algo que no esté en tu información, para ver sus límites',
              ].map((q, i) => (
                <li key={q} className="flex gap-2.5">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-50 text-[12.5px] font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{q}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            title="Información que usa la IA"
            description="Lo que tu recepcionista tiene disponible para responder. Edítalo desde cada sección del panel."
          >
            <InfoGroup title="Servicios y precios" count={svc.length} open>
              {svc.length === 0 && <li>Sin servicios configurados.</li>}
              {svc.map((s) => (
                <li key={s.name} className="flex justify-between gap-3">
                  <span className="min-w-0 text-ink">{s.name}</span>
                  <span className="flex-none tabular-nums">
                    {money(s.price)}
                    {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                  </span>
                </li>
              ))}
            </InfoGroup>

            <InfoGroup title={resourceLabel} count={team.length}>
              {team.length === 0 && <li>Sin {resourceLabel.toLowerCase()} configurados.</li>}
              {team.map((name) => (
                <li key={name} className="text-ink">{name}</li>
              ))}
            </InfoGroup>

            <InfoGroup title="Base de conocimiento" count={kb.length}>
              {kb.length === 0 && (
                <li>
                  Aún no cargas información.{' '}
                  <Link href="/dashboard/agente" className="font-semibold text-brand-700 underline underline-offset-2">
                    Agregar
                  </Link>
                </li>
              )}
              {kb.map((c, i) => (
                <li key={i} className="leading-snug">{c}</li>
              ))}
            </InfoGroup>
          </Section>

          <Section title="¿Cómo funciona?">
            <p className="text-[14.5px] leading-relaxed text-ink-muted">
              Este chat usa exactamente la misma IA que recibirán tus clientes por WhatsApp y
              Telegram. Puede agendar, responder dudas y escalar a una persona, todo automático.
            </p>
          </Section>
        </aside>
      </div>
    </Page>
  )
}
