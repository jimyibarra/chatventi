import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicBooking } from '@/features/reservas-web/components/public-booking'
import { DEFAULT_RESOURCE_LABEL } from '@/features/profesionales/types'

export const dynamic = 'force-dynamic'

type Branding = {
  primary_color?: string
  description?: string
  logo_url?: string
  whatsapp_number?: string
  // Etiqueta del vertical: Profesionales / Salas / Equipos / a medida.
  resource_label?: string
} | null

// Deep link de WhatsApp con el pedido prellenado (Ola 3: pedidos por chat).
function waOrderLink(number: string, orgName: string, product: { name: string; price: number | null }): string {
  const text = `Hola ${orgName} 👋 Quiero pedir: ${product.name}${
    product.price != null ? ` ($${product.price})` : ''
  }. Lo vi en su página de reservas.`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

type Ctx = {
  org: { name: string; branding: Branding }
  branch: { id: string; name: string; timezone: string } | null
  services: { id: string; name: string; duration_minutes: number; price: number | null }[]
  resources: { id: string; name: string; photo_url: string | null; service_ids: string[] }[]
  products: { id: string; name: string; price: number | null; image_url: string | null; description: string | null }[]
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_booking_context', { p_slug: slug })
  const ctx = data as unknown as Ctx | null
  return { title: ctx?.org?.name ? `Reserva en ${ctx.org.name}` : 'Reservar cita' }
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { slug } = await params
  const { embed } = await searchParams
  const isEmbed = embed === '1'

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_booking_context', { p_slug: slug })
  const ctx = data as unknown as Ctx | null

  if (!ctx || !ctx.branch) notFound()

  const primary = ctx.org.branding?.primary_color || '#2563eb'
  const description = ctx.org.branding?.description
  const logo = ctx.org.branding?.logo_url

  return (
    <div className={isEmbed ? 'p-3' : 'min-h-screen bg-surface'}>
      <div className={isEmbed ? 'mx-auto max-w-md' : 'mx-auto max-w-2xl px-4 py-8'}>
        {/* Encabezado con branding */}
        {!isEmbed && (
          <header className="mb-6 flex items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={ctx.org.name} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{ background: primary }}
              >
                {ctx.org.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-ink">{ctx.org.name}</h1>
              {description && <p className="text-sm text-ink-muted">{description}</p>}
            </div>
          </header>
        )}

        <PublicBooking
          slug={slug}
          branchId={ctx.branch.id}
          tz={ctx.branch.timezone}
          services={ctx.services}
          resources={ctx.resources ?? []}
          resourceLabel={ctx.org.branding?.resource_label || DEFAULT_RESOURCE_LABEL}
          primaryColor={primary}
        />

        {/* Tienda de productos */}
        {!isEmbed && ctx.products.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-ink">Productos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {ctx.products.map((p) => (
                <div
                  key={p.id}
                  className="flex gap-3 rounded-card border border-line bg-white p-3"
                  data-testid="pub-product"
                >
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    {p.description && <p className="text-xs text-ink-soft">{p.description}</p>}
                    {p.price != null && (
                      <p className="mt-1 text-sm font-semibold" style={{ color: primary }}>
                        ${p.price}
                      </p>
                    )}
                    {ctx.org.branding?.whatsapp_number && (
                      <a
                        href={waOrderLink(ctx.org.branding.whatsapp_number, ctx.org.name, p)}
                        target="_blank"
                        rel="noopener"
                        data-testid="pub-product-order"
                        className="mt-2 inline-block rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                        style={{ background: '#25D366' }}
                      >
                        Pedir por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isEmbed && (
          <p className="mt-8 text-center text-xs text-ink-faint">
            Reservas con tecnología de ChatVenti
          </p>
        )}
      </div>
    </div>
  )
}
