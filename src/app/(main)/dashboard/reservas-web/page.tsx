import { createClient } from '@/lib/supabase/server'
import { WebConfigForm } from '@/features/reservas-web/components/web-config-form'
import { Page, PageHeader } from '@/shared/components/ui/page-header'

export const dynamic = 'force-dynamic'

type Branding = { primary_color?: string; description?: string; logo_url?: string } | null

export default async function ReservasWebPage() {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, web_slug, branding')
    .maybeSingle()

  return (
    <Page>
      <PageHeader
        title="Reservas Web"
        subtitle="Publica una página donde tus clientes reservan solos, e incrústala en tu sitio con el widget."
      />

      <WebConfigForm
        orgId={org?.id ?? ''}
        webSlug={org?.web_slug ?? null}
        branding={(org?.branding ?? null) as Branding}
      />
    </Page>
  )
}
