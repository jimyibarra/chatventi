import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { WebConfigForm } from '@/features/reservas-web/components/web-config-form'
import { ProductManager } from '@/features/reservas-web/components/product-manager'

export const dynamic = 'force-dynamic'

type Branding = { primary_color?: string; description?: string; logo_url?: string } | null

export default async function ReservasWebPage() {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('web_slug, branding')
    .maybeSingle()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description')
    .order('name')

  return (
    <>
      <nav className="flex gap-4 border-b border-gray-200 bg-white px-6 py-2 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
          Panel
        </Link>
        <Link href="/dashboard/agenda" className="text-gray-500 hover:text-gray-900">
          Agenda
        </Link>
        <Link href="/dashboard/conversaciones" className="text-gray-500 hover:text-gray-900">
          Conversaciones
        </Link>
        <span className="font-medium text-gray-900">Reservas Web</span>
      </nav>

      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reservas Web</h1>
          <p className="text-sm text-gray-500">
            Publica una página donde tus clientes reservan solos, e incrústala en tu sitio con el
            widget.
          </p>
        </div>

        <WebConfigForm
          webSlug={org?.web_slug ?? null}
          branding={(org?.branding ?? null) as Branding}
        />
        <ProductManager products={products ?? []} />
      </div>
    </>
  )
}
