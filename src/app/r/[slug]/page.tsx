import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicBooking } from '@/features/reservas-web/components/public-booking'
import { DEFAULT_RESOURCE_LABEL } from '@/features/profesionales/types'
import { safeHex, strokeOnWhite, textOn } from '@/shared/lib/color'

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
  services: { id: string; name: string; duration_minutes: number; price: number | null; price_text?: string | null }[]
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

  // El color de marca del negocio manda en esta página (botón, selección y
  // estaciones). Se valida y se decide qué texto aguanta encima: un dueño puede
  // elegir un amarillo claro y el texto blanco dejaría de leerse.
  const primary = safeHex(ctx.org.branding?.primary_color, '#2563eb')
  const description = ctx.org.branding?.description
  const logo = ctx.org.branding?.logo_url
  const brandVars = {
    '--brand': primary,
    '--on-brand': textOn(primary),
    '--brand-ink': strokeOnWhite(primary),
  } as React.CSSProperties

  return (
    <div className={`cv-panel ${isEmbed ? 'p-3' : 'min-h-screen bg-surface'}`} style={brandVars}>
      <div className={isEmbed ? 'mx-auto max-w-md' : 'mx-auto max-w-[680px] px-4 pb-10 pt-6 sm:pt-10'}>
        {/* Encabezado con la marca del negocio */}
        {!isEmbed && (
          <header className="mb-5 flex items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={ctx.org.name}
                className="h-16 w-16 flex-none rounded-[18px] bg-white object-cover shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)]"
              />
            ) : (
              <span
                className="grid h-16 w-16 flex-none place-items-center rounded-[18px] bg-[color:var(--brand)] text-[1.6rem] font-bold text-[color:var(--on-brand)]"
                aria-hidden
              >
                {ctx.org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">
                {ctx.org.name}
              </h1>
              {description ? (
                <p className="mt-0.5 max-w-[60ch] text-[15px] leading-snug text-ink-muted">{description}</p>
              ) : (
                <p className="mt-0.5 text-[15px] text-ink-muted">Reserva tu cita en línea.</p>
              )}
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
        />

        {!isEmbed && (
          <p className="mt-8 text-center text-[13px] text-ink-muted">Reservas con tecnología de ChatVenti</p>
        )}
      </div>
    </div>
  )
}
