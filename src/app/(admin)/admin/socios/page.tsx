import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PartnersPanel, type PartnerRow } from '@/features/admin/components/partners-panel'
import { Page, PageHeader } from '@/shared/components/ui'

export const metadata: Metadata = { title: 'Super Admin · Socios' }
export const dynamic = 'force-dynamic'

export default async function AdminSociosPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_list_partners')
  const rows = (data ?? []) as unknown as PartnerRow[]

  return (
    <Page>
      <PageHeader
        title="Socios"
        subtitle="Un socio da de alta negocios por API con su clave. Al externo, ChatVenti le factura cada mes el plan de cada negocio (con su descuento) y el uso de IA. Al interno (otra plataforma de Grupo ELRI, como PASEN) no se le factura: él le cobra a su cliente. La guía de integración está en docs/api-socios.md del repositorio."
      />
      <PartnersPanel rows={rows} />
    </Page>
  )
}
