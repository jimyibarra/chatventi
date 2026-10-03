import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmbeddedSignupButton } from '@/features/conexiones/components/embedded-signup-button'
import { ConnectPagesButton } from '@/features/conexiones/components/connect-pages-button'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { planById } from '@/features/billing/plans'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { channelIcon } from '@/shared/components/ui/channel'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { tone: ChipTone; label: string }> = {
  active: { tone: 'ok', label: 'Activo' },
  pending: { tone: 'neutral', label: 'Pendiente de activación' },
  disabled: { tone: 'off', label: 'Desactivado' },
}

// Configuración de "Inicio de sesión con Facebook para empresas" que pide los
// permisos de páginas e Instagram. No es un secreto (viaja en el navegador);
// la variable solo existe para poder cambiarla sin tocar el código.
const PAGES_CONFIG_ID = process.env.NEXT_PUBLIC_META_PAGES_CONFIG_ID ?? '904116956101183'

type ChannelRow = { id: string; type: string; external_id: string; waba_id: string | null; display_name: string | null; status: string }

function ChannelList({ rows, empty, detail }: { rows: ChannelRow[]; empty: string; detail: (c: ChannelRow) => string }) {
  if (rows.length === 0) {
    return (
      <p className="mb-4 flex items-center gap-2.5 rounded-[14px] bg-surface p-3.5 text-[14.5px] text-ink-muted">
        <i className="h-2.5 w-2.5 flex-none rounded-full border-2 border-ink-faint" aria-hidden />
        {empty}
      </p>
    )
  }
  return (
    <ul className="mb-4 space-y-2">
      {rows.map((ch) => {
        const st = STATUS[ch.status] ?? { tone: 'neutral' as const, label: ch.status }
        return (
          <li key={ch.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-surface px-3.5 py-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-white text-ink shadow-[0_1px_0_#dde2f0]" aria-hidden>
              <Icon name={channelIcon(ch.type)} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 basis-[12rem]">
              <p className="truncate text-[15px] font-semibold text-ink">{ch.display_name ?? detail(ch)}</p>
              <p className="truncate text-[13px] tabular-nums text-ink-muted">{detail(ch)}</p>
            </div>
            <StatusChip tone={st.tone}>{st.label}</StatusChip>
          </li>
        )
      })}
    </ul>
  )
}

export default async function ConexionesPage() {
  const supabase = await createClient()

  // Solo columnas NO secretas (nunca `credentials`, que trae el access_token).
  const [{ data }, sub] = await Promise.all([
    supabase
      .from('channels')
      .select('id, type, external_id, waba_id, display_name, status')
      .in('type', ['whatsapp', 'instagram', 'messenger'])
      .order('created_at', { ascending: false }),
    getMySubscription(),
  ])
  const channels = (data ?? []) as ChannelRow[]
  const whatsapp = channels.filter((c) => c.type === 'whatsapp')
  const social = channels.filter((c) => c.type !== 'whatsapp')

  const appId = process.env.NEXT_PUBLIC_META_APP_ID ?? ''
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? ''
  // En la prueba gratis se puede conectar todo; con plan, desde Profesional.
  const socialAllowed = !subIsActive(sub) || planById(sub?.plan_id).aiChannels.includes('Instagram')

  return (
    <Page width="narrow">
      <PageHeader
        title="Conexiones"
        subtitle="Conecta los canales por los que te escriben tus clientes. Tu recepcionista atiende en todos con la misma agenda."
      />

      <div className="space-y-4">
        <Section
          title="WhatsApp"
          badge={whatsapp.some((c) => c.status === 'active') ? <StatusChip tone="ok" size="md">Conectado</StatusChip> : undefined}
          description="Con el inicio de sesión de Meta eliges (o creas) tu cuenta de WhatsApp Business y tu número. Los mensajes los cobra Meta directamente a esa cuenta."
        >
          <ChannelList
            rows={whatsapp}
            empty="Todavía no has conectado ningún WhatsApp."
            detail={(c) => `ID: ${c.external_id}${c.waba_id ? ` · WABA ${c.waba_id}` : ''}`}
          />
          <EmbeddedSignupButton appId={appId} configId={configId} />
        </Section>

        <Section
          data-testid="social-channels"
          title="Instagram y Messenger"
          badge={social.some((c) => c.status === 'active') ? <StatusChip tone="ok" size="md">Conectado</StatusChip> : undefined}
          description="Conecta la página de Facebook de tu negocio; si tiene un Instagram profesional enlazado, se conecta también. Necesitas ser administrador de la página."
        >
          <ChannelList
            rows={social}
            empty="Todavía no has conectado tu página ni tu Instagram."
            detail={(c) => (c.type === 'instagram' ? 'Mensajes directos de Instagram' : 'Messenger de la página de Facebook')}
          />
          {socialAllowed ? (
            <>
              <ConnectPagesButton appId={appId} configId={PAGES_CONFIG_ID} />
              <p className="mt-3 flex max-w-[65ch] items-start gap-2 text-[13.5px] leading-snug text-ink-muted">
                <Icon name="info" className="mt-px h-4 w-4" />
                <span>
                  Para Instagram: en la app de Instagram, entra a Configuración → Mensajes → Herramientas
                  conectadas y activa «Permitir acceso a los mensajes». Sin eso, Instagram no nos entrega
                  los mensajes.
                </span>
              </p>
            </>
          ) : (
            <Notice
              tone="info"
              action={
                <Link href="/dashboard/facturacion" className="inline-flex min-h-[40px] items-center rounded-[11px] px-2.5 text-sm font-semibold text-brand-800 underline underline-offset-2">
                  Ver planes
                </Link>
              }
            >
              Instagram y Messenger vienen incluidos desde el plan Profesional.
            </Notice>
          )}
        </Section>
      </div>
    </Page>
  )
}
