import Link from 'next/link'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { PROMO_CODE, PROMO_LABEL, DATA_RETENTION_DAYS } from '@/features/billing/plans'

// Pantalla de bloqueo cuando la prueba gratis terminó y no hay suscripción.
// Los datos se conservan hasta el borrado (día 30); se invita a suscribirse con
// la promo. La página de facturación sí queda accesible (para poder pagar).
export function SubscriptionRequired({ deleteLabel }: { deleteLabel: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-card border border-line bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/chatventi-logo.png" alt="ChatVenti" className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Tu prueba gratis terminó</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          Esperamos que ChatVenti te haya sido útil. Para seguir usando tu agenda y tu
          recepcionista con IA, suscríbete a un plan. <strong>Tus datos están a salvo</strong> y los
          conservamos {deleteLabel ? <>hasta el <strong>{deleteLabel}</strong></> : 'unos días más'}.
        </p>

        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-ink-muted">Usa este código al suscribirte y obtén</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{PROMO_LABEL}</p>
          <p className="mt-2 inline-block rounded-lg border border-dashed border-brand-400 bg-white px-4 py-1.5 font-mono text-base font-bold tracking-wider text-brand-700">
            {PROMO_CODE}
          </p>
        </div>

        <Link
          href="/dashboard/facturacion"
          className="mt-6 inline-block w-full rounded-lg bg-brand-500 px-4 py-3 font-medium text-white shadow-btn hover:bg-brand-600"
        >
          Suscribirme y seguir usando ChatVenti
        </Link>

        <p className="mt-4 text-xs text-ink-soft">
          Si no te suscribes, los datos de tu negocio se eliminarán al pasar{' '}
          {DATA_RETENTION_DAYS} días desde tu registro. Tu cuenta seguirá disponible por si
          decides volver.
        </p>
        <div className="mt-6 border-t border-line-row pt-4">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
