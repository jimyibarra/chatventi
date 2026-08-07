import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicBooking } from '@/features/reservas-web/components/public-booking'
import { DEFAULT_RESOURCE_LABEL } from '@/features/profesionales/types'

export const dynamic = 'force-dynamic'

type Branding = {
  primary_color?: string
  description?: string
  logo_url?: string
  // Etiqueta del vertical: Profesionales / Salas / Equipos / a medida.
  resource_label?: string
} | null

// El escaparate de productos se retiró el 2026-08-06 (decisión de Juan: la
// página pública se centra en reservar). La RPC get_public_booking_context
// sigue devolviendo `products`; este tipo simplemente lo ignora. La tabla y
// la RPC se limpian en una fase contract posterior.
type Ctx = {
  org: { name: string; branding: Branding }
  branch: { id: string; name: string; timezone: string } | null
  services: { id: string; name: string; duration_minutes: number; price: number | null }[]
  resources: { id: string; name: string; photo_url: string | null; service_ids: string[] }[]
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

        {!isEmbed && (
          <p className="mt-8 text-center text-xs text-ink-faint">
            Reservas con tecnología de ChatVenti
          </p>
        )}
      </div>
    </div>
  )
}
