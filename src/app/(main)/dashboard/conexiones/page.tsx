import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmbeddedSignupButton } from '@/features/conexiones/components/embedded-signup-button'
import { ConnectPagesButton } from '@/features/conexiones/components/connect-pages-button'
import { metaAppForOrg } from '@/features/marca/meta-app'
import { brandOrigin, currentBrand } from '@/features/marca/brand'
import { createServiceClient } from '@/lib/supabase/service'
import { buildSignupPrefill } from '@/features/conexiones/meta-helpers'
import { getWabaHealth, wabaBillingUrl, type WabaHealth } from '@/features/conexiones/waba-health'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { planById } from '@/features/billing/plans'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { ButtonLink } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { channelIcon } from '@/shared/components/ui/channel'
import { MyTemplates } from '@/features/wa-plantillas/components/my-templates'

export const dynamic = 'force-dynamic'

// Fase 1 de coexistencia (14-oct-2026): solo estas organizaciones ven el botón
// «Conectar el número que ya uso en WhatsApp Business». Lista corta a propósito.
const COEXISTENCE_ORG_IDS = new Set([
  '17a720a3-8f4f-40e7-93e7-abd796c5b2f0', // ¡Pasen! (ventas)
  '7ab0c2ea-b424-467a-970b-071b1ff1f1a7', // ChatVenti Demo
])
// Facebook e Instagram para negocios de SOCIO: apagado hasta que Meta apruebe el
// acceso avanzado de pages_manage_metadata (sin él, la página no queda suscrita).
const SOCIAL_FOR_PARTNER_ORGS = false

/** Etiqueta del canal. Un Messenger/Instagram «pendiente» es Meta sin autorizar la suscripción, no una espera nuestra. */
function statusFor(ch: { type: string; status: string }): { tone: ChipTone; label: string } {
  if (ch.status === 'pending' && (ch.type === 'messenger' || ch.type === 'instagram')) {
    return { tone: 'wait', label: 'Meta no autorizó recibir sus mensajes · en revisión' }
  }
  return STATUS[ch.status] ?? { tone: 'neutral', label: ch.status }
}

const STATUS: Record<string, { tone: ChipTone; label: string }> = {
  active: { tone: 'ok', label: 'Activo' },
  pending: { tone: 'neutral', label: 'Pendiente de activación' },
  disabled: { tone: 'off', label: 'Desactivado' },
}

// Configuración de "Inicio de sesión con Facebook para empresas" que pide los
// permisos de páginas e Instagram. No es un secreto (viaja en el navegador);
// la variable solo existe para poder cambiarla sin tocar el código.

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
        const st = statusFor(ch)
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

/**
 * Tarjeta en Meta de cada WhatsApp conectado. Meta cobra los recordatorios y
 * los mensajes que inicia el negocio a ESA tarjeta: sin ella no salen. El
 * estado viene de health_status (error 141006 = problema con el método de pago).
 */
function WabaBilling({ items }: { items: { id: string; name: string; wabaId: string; health: WabaHealth }[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-4 space-y-2" data-testid="waba-billing">
      {items.map((it) => {
        const url = wabaBillingUrl(it.wabaId, it.health.businessId)
        const button = (
          <ButtonLink href={url} target="_blank" rel="noopener noreferrer" variant={it.health.payment === 'missing' ? 'primary' : 'secondary'} size="sm">
            <Icon name="card" className="h-4 w-4" />
            {it.health.payment === 'missing' ? 'Poner mi tarjeta en Meta' : 'Ver o cambiar mi tarjeta en Meta'}
          </ButtonLink>
        )
        if (it.health.payment === 'missing') {
          return (
            <Notice key={it.id} tone="action" title={`Falta la tarjeta en Meta para ${it.name}`} action={button}>
              Meta reporta un problema con el método de pago de tu cuenta de WhatsApp. Sin él no salen los recordatorios ni
              los mensajes después de 24 horas. Las respuestas a quien te escribe sí salen. Si al abrir no ves tu cuenta,
              elige tu cuenta de WhatsApp en la lista.
            </Notice>
          )
        }
        return (
          <div key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-ink-muted">
            <span>
              Tarjeta en Meta para {it.name}: {it.health.payment === 'ok' ? 'sin problemas reportados.' : 'no pudimos consultarla ahora.'}
            </span>
            {button}
          </div>
        )
      })}
    </div>
  )
}

export default async function ConexionesPage() {
  const supabase = await createClient()

  // Solo columnas NO secretas (nunca `credentials`, que trae el access_token).
  const [{ data }, sub, { data: orgId }] = await Promise.all([
    supabase
      .from('channels')
      .select('id, type, external_id, waba_id, display_name, status')
      .in('type', ['whatsapp', 'instagram', 'messenger'])
      .order('created_at', { ascending: false }),
    getMySubscription(),
    supabase.rpc('get_my_org'),
  ])
  const channels = (data ?? []) as ChannelRow[]
  const whatsapp = channels.filter((c) => c.type === 'whatsapp')
  const social = channels.filter((c) => c.type !== 'whatsapp')

  // La app de Meta del socio del negocio (nivel 3 de marca) o la de ChatVenti.
  const meta = await metaAppForOrg((orgId as string | null) ?? null)
  // Negocios de socio (¡Pasen!): la ventana de Meta es de la app ChatVenti; se les avisa para que no extrañe.
  const brand = await currentBrand()
  const metaNote = brand.partnerId && !meta?.partnerId ? ` La ventana de Meta dice «ChatVenti»: es la tecnología con la que trabaja ${brand.name}.` : ''
  const coexistence = !!orgId && COEXISTENCE_ORG_IDS.has(orgId as string)

  // Datos que Meta deja precargar en la ventana de WhatsApp: el dueño confirma
  // en vez de escribir. service_role acotado a la org de la sesión.
  const service = createServiceClient()
  const [{ data: org }, { data: authUser }] = await Promise.all([
    orgId
      ? service
          .from('organizations')
          .select('name, phone, country, site_url, contact_email, business_type, web_slug')
          .eq('id', orgId as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ])
  const prefill = org
    ? buildSignupPrefill({
        name: org.name,
        email: org.contact_email ?? authUser.user?.email ?? null,
        website: org.site_url ?? (org.web_slug ? `${brandOrigin(brand)}/r/${org.web_slug}` : null),
        phone: org.phone,
        country: org.country,
        businessType: org.business_type,
      })
    : null

  // Tarjeta en Meta de cada WhatsApp conectado (consulta con tope de 4 s por cuenta).
  const billing = await Promise.all(
    whatsapp
      .filter((c) => c.waba_id && c.status !== 'disabled')
      .map(async (c) => ({
        id: c.id,
        name: c.display_name ?? 'tu WhatsApp',
        wabaId: c.waba_id as string,
        health: await getWabaHealth(c.waba_id as string, meta?.systemUserToken),
      }))
  )
  const socialBlockedForPartner = !!brand.partnerId && !SOCIAL_FOR_PARTNER_ORGS
  const appId = meta?.appId ?? ''
  const configId = meta?.configId ?? ''
  const PAGES_CONFIG_ID = meta?.pagesConfigId ?? ''
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
          description={`Con el inicio de sesión de Meta eliges (o creas) tu cuenta de WhatsApp Business y tu número. Los mensajes los cobra Meta directamente a esa cuenta.${metaNote}`}
          actions={
            <ButtonLink href="/ayuda/whatsapp" variant="secondary" size="sm" target="_blank" data-testid="guia-whatsapp">
              <Icon name="book" className="h-4 w-4" />
              Guía paso a paso
            </ButtonLink>
          }
        >
          <ChannelList
            rows={whatsapp}
            empty="Todavía no has conectado ningún WhatsApp."
            detail={(c) => `ID: ${c.external_id}${c.waba_id ? ` · WABA ${c.waba_id}` : ''}`}
          />
          <WabaBilling items={billing} />
          <EmbeddedSignupButton appId={appId} configId={configId} prefill={prefill} />
          {coexistence && (
            <div className="mt-3 space-y-2">
              <EmbeddedSignupButton appId={appId} configId={configId} coexistence prefill={prefill} />
              <p className="max-w-[65ch] text-[13.5px] leading-snug text-ink-muted">
                Prueba de coexistencia: el número sigue en tu app de WhatsApp Business y la recepcionista contesta desde aquí. Necesitas la app actualizada (2.24.17 o más nueva).
              </p>
            </div>
          )}
        </Section>

        {orgId && whatsapp.length > 0 && <MyTemplates orgId={orgId as string} />}

        <Section
          data-testid="social-channels"
          title="Instagram y Messenger"
          badge={social.some((c) => c.status === 'active') ? <StatusChip tone="ok" size="md">Conectado</StatusChip> : undefined}
          description={`Conecta la página de Facebook de tu negocio; si tiene un Instagram profesional enlazado, se conecta también. Necesitas ser administrador de la página.${metaNote}`}
          actions={
            <ButtonLink href="/ayuda/facebook-instagram" variant="secondary" size="sm" target="_blank" data-testid="guia-fb-ig">
              <Icon name="book" className="h-4 w-4" />
              Guía paso a paso
            </ButtonLink>
          }
        >
          <ChannelList
            rows={social}
            empty="Todavía no has conectado tu página ni tu Instagram."
            detail={(c) => (c.type === 'instagram' ? 'Mensajes directos de Instagram' : 'Messenger de la página de Facebook')}
          />
          {socialBlockedForPartner ? (
            <Notice tone="info">
              Facebook e Instagram para los negocios de {brand.name} quedan pendientes de una revisión de Meta. WhatsApp sí está disponible. Te avisamos en cuanto Meta apruebe.
            </Notice>
          ) : socialAllowed ? (
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
              Tu plan actual no incluye Instagram ni Messenger.
            </Notice>
          )}
        </Section>
      </div>
    </Page>
  )
}
