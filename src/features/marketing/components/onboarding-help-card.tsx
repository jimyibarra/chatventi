import { CALL_URL, ONBOARDING_HELP_PRICE_USD } from '@/features/marketing/config'
import { Section } from '@/shared/components/ui/card'
import { buttonClass } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

// Upsell de onboarding asistido: para el dueño no técnico que prefiere que le
// dejen la cuenta lista. Ingreso extra + palanca de activación (menos churn).
// El CTA lleva a CALL_URL (WhatsApp/Calendly/correo); el cobro se coordina ahí.
export function OnboardingHelpCard() {
  return (
    <Section
      className="mt-4"
      title="¿Prefieres que lo hagamos por ti?"
      description="Configuración asistida 1 a 1: nos conectamos por videollamada y dejamos tu cuenta lista para vender (servicios, horarios, tu página de reservas y la Recepcionista IA con el tono de tu negocio)."
      actions={
        <p className="text-right leading-tight">
          <span className="block text-[1.6rem] font-bold tabular-nums text-ink">${ONBOARDING_HELP_PRICE_USD}</span>
          <span className="text-[13px] text-ink-muted">pago único</span>
        </p>
      }
    >
      <a
        href={CALL_URL}
        target="_blank"
        rel="noopener"
        data-testid="onboarding-help-cta"
        className={buttonClass('secondary')}
      >
        <Icon name="phone" />
        Quiero que me ayuden
      </a>
    </Section>
  )
}
