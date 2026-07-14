import { PROMO_CODE, PROMO_LABEL, DATA_RETENTION_DAYS } from '@/features/billing/plans'

// Banner que se muestra en Facturación cuando la prueba gratis terminó y no hay
// suscripción. Invita a suscribirse con la promo; los datos se conservan hasta
// el borrado (día 30). La calculadora de planes va debajo, así pueden pagar.
export function TrialEndedBanner({ deleteLabel }: { deleteLabel: string | null }) {
  return (
    <div className="mb-6 rounded-card border border-brand-200 bg-brand-50 p-5">
      <h2 className="text-lg font-bold text-ink">Tu prueba gratis terminó</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Para seguir usando tu agenda y tu recepcionista con IA, suscríbete abajo.{' '}
        <strong>Tus datos están a salvo</strong>
        {deleteLabel ? (
          <>
            {' '}
            y los conservamos hasta el <strong>{deleteLabel}</strong>.
          </>
        ) : (
          ' unos días más.'
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-muted">Usa el código y obtén {PROMO_LABEL}:</span>
        <span className="rounded-lg border border-dashed border-brand-400 bg-white px-3 py-1 font-mono text-sm font-bold tracking-wider text-brand-700">
          {PROMO_CODE}
        </span>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Si no te suscribes, los datos de tu negocio se eliminarán al pasar {DATA_RETENTION_DAYS} días
        desde tu registro. Tu cuenta seguirá disponible por si decides volver.
      </p>
    </div>
  )
}
