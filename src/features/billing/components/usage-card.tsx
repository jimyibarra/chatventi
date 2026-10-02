import { EXTRA_REPLY_PRICE_USD, planById, usageOverage, type PlanId } from '@/features/billing/plans'

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
    <section className="mt-6 rounded-card border border-line bg-white p-6" data-testid="usage-card">
      <h2 className="text-base font-semibold text-ink">Uso de tu recepcionista en {month}</h2>
      <p className="mt-3 text-3xl font-extrabold tabular-nums text-ink">
        {n(aiReplies)}
        <span className="ml-2 text-sm font-medium text-ink-muted">
          {usage ? `de ${n(usage.included)} respuestas incluidas` : 'respuestas de IA'}
        </span>
      </p>

      {usage && planId && (
        <>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div
              className={`h-full rounded-full ${usage.extra > 0 ? 'bg-amber-500' : 'bg-brand-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {managed ? (
            <p className="mt-3 text-sm text-ink-soft">
              Tu recepcionista atiende sin interrupciones. El plan y el uso los cubre tu proveedor.
            </p>
          ) : usage.extra > 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              Llevas <strong>{n(usage.extra)}</strong> respuestas por encima de lo incluido en el plan{' '}
              {planById(planId).name}: <strong>${usage.chargeUsd.toFixed(2)} USD</strong> que se suman a tu
              siguiente factura. Tu recepcionista sigue atendiendo sin interrupciones.
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">
              Vas dentro de lo incluido en tu plan. Si algún mes lo rebasas, tu recepcionista no se
              detiene: cada 1,000 respuestas adicionales cuestan ${per1000} USD y se suman a tu
              siguiente factura.
            </p>
          )}
        </>
      )}
      {!usage && (
        <p className="mt-3 text-sm text-ink-soft">
          Al activar tu plan verás aquí cuánto llevas usado de lo que incluye.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        Los mensajes de WhatsApp los cobra Meta directamente a la cuenta de WhatsApp de tu negocio;
        ChatVenti no les añade nada.
      </p>
    </section>
  )
}
