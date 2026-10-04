import { ButtonLink } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

// Aviso de cobro fallido, arriba de TODO el panel del dueño. Es lo único que
// pide una acción: va en amarillo («Líneas»). Durante la gracia todo sigue
// funcionando; al terminar, la recepcionista se pausa hasta que se pague.
export function PaymentIssueBanner({ state, until }: { state: 'grace' | 'blocked'; until: Date | null }) {
  const date = until
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(until)
    : null
  return (
    <section
      className="mx-4 mt-3 rounded-card bg-[#ffcd2e] p-4 text-ink md:mx-6 md:p-5"
      aria-label="Tu pago no se pudo cobrar"
      data-testid="payment-issue"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-ink text-[#ffcd2e]" aria-hidden>
          <Icon name="card" />
        </span>
        <div className="min-w-0 flex-1 basis-[16rem]">
          <h2 className="text-[1.1rem] font-bold leading-tight">
            {state === 'grace' ? 'No pudimos cobrar tu plan' : 'Tu recepcionista está en pausa'}
          </h2>
          <p className="mt-1 max-w-[64ch] text-[15px] leading-snug">
            {state === 'grace'
              ? `Tu banco rechazó el cobro de la renovación. Todo sigue funcionando${date ? ` hasta el ${date}` : ''}: paga o cambia tu tarjeta antes para que tu recepcionista no se detenga.`
              : 'No se pudo cobrar la renovación y terminaron los días de gracia. Paga la factura pendiente y todo vuelve a funcionar al instante: tus datos y conversaciones siguen guardados.'}
          </p>
        </div>
        <ButtonLink href="/dashboard/facturacion#pagos" variant="secondary" className="self-center">
          Pagar o cambiar tarjeta
        </ButtonLink>
      </div>
    </section>
  )
}
