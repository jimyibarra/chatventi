import { EXTRA_REPLY_PRICE_USD, planById, usageOverage, type PlanId } from '@/features/billing/plans'
import { Section } from '@/shared/components/ui/card'

const n = (v: number) => v.toLocaleString('en-US')

/**
 * Uso de IA del mes en curso frente a lo que incluye el plan. Usa la misma
 * fórmula (usageOverage) que el cierre mensual que carga en Stripe: lo que
 * aquí se ve es lo que se cobra.
 */
export function UsageCard({
  aiReplies,
  planId,
  managed = false,
}: {
  aiReplies: number
  planId: PlanId | null
  /** Plan administrado por un socio: el negocio no le paga nada a ChatVenti. */
  managed?: boolean
}) {
  const month = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(new Date())
  const usage = planId ? usageOverage(planId, aiReplies) : null
  const pct = usage ? Math.min(100, Math.round((aiReplies / Math.max(1, usage.included)) * 100)) : 0
  const per1000 = (EXTRA_REPLY_PRICE_USD * 1000).toFixed(2)

  return (
    <Section className="mt-4" data-testid="usage-card" title={`Uso de tu recepcionista en ${month}`}>
      <p className="text-[2rem] font-bold leading-tight tabular-nums text-ink">
        {n(aiReplies)}
        <span className="ml-2 text-[15px] font-semibold text-ink-muted">
          {usage ? `de ${n(usage.included)} respuestas incluidas` : 'respuestas de IA'}
        </span>
      </p>

      {usage && planId && (
        <>
          {/* Lo incluido en violeta; lo que pasa del plan, en tinta. */}
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Uso del plan"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${usage.extra > 0 ? 'bg-ink' : 'bg-brand-500'}`}
              style={{ width: `${Math.max(pct, aiReplies > 0 ? 2 : 0)}%` }}
            />
          </div>
          {managed ? (
            <p className="mt-3 max-w-[65ch] text-[14.5px] leading-snug text-ink-muted">
              Tu recepcionista atiende sin interrupciones. El plan y el uso los cubre tu proveedor.
            </p>
          ) : usage.extra > 0 ? (
            <p className="mt-3 max-w-[65ch] text-[14.5px] leading-snug text-ink-muted">
              Llevas <strong className="text-ink">{n(usage.extra)}</strong> respuestas por encima de lo incluido en el plan{' '}
              {planById(planId).name}: <strong className="text-ink">${usage.chargeUsd.toFixed(2)} USD</strong> que se suman a tu
              siguiente factura. Tu recepcionista sigue atendiendo sin interrupciones.
            </p>
          ) : (
            <p className="mt-3 max-w-[65ch] text-[14.5px] leading-snug text-ink-muted">
              Vas dentro de lo incluido en tu plan. Si algún mes lo rebasas, tu recepcionista no se
              detiene: cada 1,000 respuestas adicionales cuestan ${per1000} USD y se suman a tu
              siguiente factura.
            </p>
          )}
        </>
      )}
      {!usage && (
        <p className="mt-2 text-[14.5px] text-ink-muted">
          Al activar tu plan verás aquí cuánto llevas usado de lo que incluye.
        </p>
      )}
      <p className="mt-3 border-t border-line pt-3 text-[13px] leading-snug text-ink-muted">
        Los mensajes de WhatsApp los cobra Meta directamente a la cuenta de WhatsApp de tu negocio;
        ChatVenti no les añade nada.
      </p>
    </Section>
  )
}
