import { PROMO_CODE, PROMO_LABEL, DATA_RETENTION_DAYS } from '@/features/billing/plans'
import { Icon } from '@/shared/components/ui/icon'

// Banner que se muestra en Facturación cuando la prueba gratis terminó y no hay
// suscripción. Invita a suscribirse con la promo; los datos se conservan hasta
// el borrado (día 30). La calculadora de planes va debajo, así pueden pagar.
// Es lo único de la pantalla que pide una acción: va en amarillo.
export function TrialEndedBanner({ deleteLabel }: { deleteLabel: string | null }) {
  return (
    <section className="mb-4 rounded-card bg-[#ffcd2e] p-4 text-ink md:p-5" aria-label="Tu prueba gratis terminó">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-ink text-[#ffcd2e]" aria-hidden>
          <Icon name="bell" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.15rem] font-bold leading-tight">Tu prueba gratis terminó</h2>
          <p className="mt-1 max-w-[62ch] text-[15px] leading-snug">
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
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-[14px] bg-white p-3 text-[14.5px]">
        <span>Usa el código y obtén {PROMO_LABEL}:</span>
        <span className="rounded-[10px] border-2 border-dashed border-ink px-3 py-1 font-mono text-[15px] font-bold tracking-wider">
          {PROMO_CODE}
        </span>
      </div>
      <p className="mt-3 max-w-[70ch] text-[13px] leading-snug">
        Si no te suscribes, los datos de tu negocio se eliminarán al pasar {DATA_RETENTION_DAYS} días
        desde tu registro. Tu cuenta seguirá disponible por si decides volver.
      </p>
    </section>
  )
}
