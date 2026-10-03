import type { Metadata } from 'next'
import { findTrialPromo, type TrialPromo } from '@/features/billing/promo'
import { PromoForm } from '@/features/admin/components/promo-form'
import { Card, Notice, Page, PageHeader, Section, StatusChip } from '@/shared/components/ui'

export const metadata: Metadata = { title: 'Super Admin · Promoción' }
export const dynamic = 'force-dynamic'

const WHERE = [
  'Correo «Tu prueba gratis termina pronto», unos días antes del final.',
  'Correo «Tu prueba gratis terminó».',
  'Correo «Tus datos se eliminarán pronto», unos días antes del borrado.',
  'Facturación: aviso de prueba vencida y la letra pequeña del total mensual.',
  'Pago en Stripe, en el campo «Agregar código promocional» (solo planes mensuales: el anual ya trae 2 meses de regalo).',
]

export default async function AdminPromocionPage() {
  let promo: TrialPromo | null = null
  let failed = false
  try {
    promo = await findTrialPromo()
  } catch {
    failed = true
  }
  const live = process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live')

  return (
    <Page>
      <PageHeader
        title="Promoción"
        subtitle="Descuento para que los negocios se suscriban al terminar su prueba gratis. Se guarda en Stripe y de ahí lo leen los correos, Facturación y el pago."
      />
      <div className="space-y-4">
        {failed && <Notice tone="danger">No se pudo leer Stripe. Revisa la clave de Stripe e intenta de nuevo.</Notice>}
        {!failed && !promo && (
          <Notice tone="action">
            No hay promoción en Stripe ({live ? 'modo real' : 'modo prueba'}). Guárdala abajo para crearla; hasta entonces no se anuncia ningún código.
          </Notice>
        )}

        {promo && (
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-[14rem]">
              <p className="flex flex-wrap items-center gap-2 text-[1.05rem] font-bold text-ink">
                <span className="font-mono tracking-wider">{promo.code}</span>
                <StatusChip tone={promo.active ? 'ok' : 'off'}>{promo.active ? 'Encendida' : 'Apagada'}</StatusChip>
              </p>
              <p className="text-[14.5px] text-ink-muted">{promo.label}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 text-[14px]">
              <div>
                <dt className="text-[12.5px] text-ink-muted">Usos</dt>
                <dd className="font-semibold tabular-nums text-ink">{promo.redeemed.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-ink-muted">Stripe</dt>
                <dd className="font-semibold text-ink">{live ? 'Modo real' : 'Modo prueba'}</dd>
              </div>
            </dl>
          </Card>
        )}

        <PromoForm initial={promo && { code: promo.code, percent: promo.percent, months: promo.months, active: promo.active }} />

        <Section title="Dónde aparece">
          <ul className="space-y-2 text-[15px] text-ink">
            {WHERE.map((w) => (
              <li key={w} className="flex gap-2.5">
                <span className="mt-[0.55em] h-2 w-2 flex-none rounded-full bg-brand-500" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
          {!live && (
            <p className="mt-3 text-[14px] text-ink-muted">
              Cuando Stripe pase a modo real, entra aquí y pulsa «Guardar» una vez: se crea la misma promoción en la cuenta real.
            </p>
          )}
        </Section>
      </div>
    </Page>
  )
}
