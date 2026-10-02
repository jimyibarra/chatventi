import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PartnersPanel, type PartnerRow } from '@/features/admin/components/partners-panel'

export const metadata: Metadata = { title: 'Super Admin · Socios' }
export const dynamic = 'force-dynamic'

export default async function AdminSociosPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_list_partners')
  const rows = (data ?? []) as unknown as PartnerRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Socios</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Un socio da de alta negocios por API con su clave y ChatVenti le factura a él el plan y el
          uso de IA de esos negocios, una vez al mes. La guía de integración está en
          <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs">docs/api-socios.md</code>
          del repositorio.
        </p>
      </div>
      <PartnersPanel rows={rows} />
    </div>
  )
}
