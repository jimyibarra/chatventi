import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmbeddedSignupButton } from '@/features/conexiones/components/embedded-signup-button'
import { ConnectPagesButton } from '@/features/conexiones/components/connect-pages-button'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { planById } from '@/features/billing/plans'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente de activación',
  disabled: 'Desactivado',
}

// Configuración de "Inicio de sesión con Facebook para empresas" que pide los
// permisos de páginas e Instagram. No es un secreto (viaja en el navegador);
// la variable solo existe para poder cambiarla sin tocar el código.
const PAGES_CONFIG_ID = process.env.NEXT_PUBLIC_META_PAGES_CONFIG_ID ?? '904116956101183'

type ChannelRow = { id: string; type: string; external_id: string; waba_id: string | null; display_name: string | null; status: string }

function ChannelList({ rows, empty, detail }: { rows: ChannelRow[]; empty: string; detail: (c: ChannelRow) => string }) {
  if (rows.length === 0) return <p className="mb-4 text-sm text-ink-muted">{empty}</p>
  return (
    <ul className="mb-4 space-y-2">
      {rows.map((ch) => (
        <li key={ch.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-surface px-3.5 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{ch.display_name ?? detail(ch)}</p>
            <p className="truncate text-ink-muted">{detail(ch)}</p>
          </div>
          <span
            className={
              ch.status === 'active'
                ? 'shrink-0 rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success'
                : 'shrink-0 rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn'
            }
          >
            {STATUS_LABEL[ch.status] ?? ch.status}
          </span>
        </li>
      ))}
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
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink">Conexiones</h1>
        <p className="text-[15px] text-ink-muted">
          Conecta los canales por los que te escriben tus clientes. Tu recepcionista atiende en todos
          con la misma agenda.
        </p>
      </div>

      <section className="rounded-card bg-white p-5 shadow-[0_1px_0_#dde2f0]">
        <h2 className="mb-1 text-[1.15rem] font-bold text-ink">WhatsApp</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Con el inicio de sesión de Meta eliges (o creas) tu cuenta de WhatsApp Business y tu número.
          Los mensajes los cobra Meta directamente a esa cuenta.
        </p>
        <ChannelList
          rows={whatsapp}
          empty="Todavía no has conectado ningún WhatsApp."
          detail={(c) => `ID: ${c.external_id}${c.waba_id ? ` · WABA ${c.waba_id}` : ''}`}
        />
        <EmbeddedSignupButton appId={appId} configId={configId} />
      </section>

      <section className="rounded-card bg-white p-5 shadow-[0_1px_0_#dde2f0]" data-testid="social-channels">
        <h2 className="mb-1 text-[1.15rem] font-bold text-ink">Instagram y Messenger</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Conecta la página de Facebook de tu negocio; si tiene un Instagram profesional enlazado, se
          conecta también. Necesitas ser administrador de la página.
        </p>
        <ChannelList
          rows={social}
          empty="Todavía no has conectado tu página ni tu Instagram."
          detail={(c) => (c.type === 'instagram' ? 'Mensajes directos de Instagram' : 'Messenger de la página de Facebook')}
        />
        {socialAllowed ? (
          <>
            <ConnectPagesButton appId={appId} configId={PAGES_CONFIG_ID} />
            <p className="mt-3 text-xs text-ink-muted">
              Para Instagram: en la app de Instagram, entra a Configuración → Mensajes → Herramientas
              conectadas y activa «Permitir acceso a los mensajes». Sin eso, Instagram no nos entrega
              los mensajes.
            </p>
          </>
        ) : (
          <p className="rounded-[14px] bg-brand-50 p-3.5 text-sm text-brand-900">
            Instagram y Messenger vienen incluidos desde el plan Profesional.{' '}
            <Link href="/dashboard/facturacion" className="font-semibold underline">
              Ver planes
            </Link>
          </p>
        )}
      </section>
    </div>
  )
}
