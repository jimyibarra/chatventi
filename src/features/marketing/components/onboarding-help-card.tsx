import { CALL_URL, ONBOARDING_HELP_PRICE_USD } from '@/features/marketing/config'

// Upsell de onboarding asistido: para el dueño no técnico que prefiere que le
// dejen la cuenta lista. Ingreso extra + palanca de activación (menos churn).
// El CTA lleva a CALL_URL (WhatsApp/Calendly/correo); el cobro se coordina ahí.
export function OnboardingHelpCard() {
  return (
    <div className="mt-6 rounded-card border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            ¿Prefieres que lo hagamos por ti?
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink">Configuración asistida 1-a-1</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Nos conectamos por videollamada y dejamos tu cuenta lista para vender: servicios,
            horarios, tu página de reservas y la Recepcionista IA con el tono de tu negocio.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-ink">${ONBOARDING_HELP_PRICE_USD}</p>
          <p className="text-xs text-ink-faint">pago único</p>
        </div>
      </div>
      <a
        href={CALL_URL}
        target="_blank"
        rel="noopener"
        data-testid="onboarding-help-cta"
        className="mt-4 inline-block rounded-xl border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
      >
        Quiero que me ayuden →
      </a>
    </div>
  )
}
