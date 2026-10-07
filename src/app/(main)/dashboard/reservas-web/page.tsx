import { createClient } from '@/lib/supabase/server'
import { internalPartnerName } from '@/features/socios/service'
import { brandForOrg, brandOrigin } from '@/features/marca/brand'
import { WebConfigForm } from '@/features/reservas-web/components/web-config-form'
import { Page, PageHeader } from '@/shared/components/ui/page-header'

export const dynamic = 'force-dynamic'

type Branding = { primary_color?: string; description?: string; logo_url?: string } | null

export default async function ReservasWebPage() {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, web_slug, branding, site_url, partner_id')
    .maybeSingle()
  // Negocio de un socio interno (PASEN): su página web ya trae el botón de reservar.
  const partnerName = org?.partner_id ? await internalPartnerName(org.partner_id) : null
  const origin = brandOrigin(await brandForOrg(org?.id ?? null))

  return (
    <Page>
      <PageHeader
        title="Reservas Web"
        subtitle="La agenda en línea de tu negocio: el botón «Reservar cita» para tu página web y, si no tienes página, un enlace para Instagram y Google."
      />

      <WebConfigForm
        orgId={org?.id ?? ''}
        webSlug={org?.web_slug ?? null}
        branding={(org?.branding ?? null) as Branding}
        siteUrl={org?.site_url ?? null}
        partnerName={partnerName}
        origin={origin}
      />
    </Page>
  )
}
