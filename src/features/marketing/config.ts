// Constantes de marketing / conversión (compartidas cliente + servidor).
import { verticalByBusinessType } from '@/features/verticales/data'

export const SUPPORT_EMAIL = 'soporte@chatventi.com'

// Destino de "agendar una llamada" / hablar con una persona. Configúralo en
// Vercel como NEXT_PUBLIC_CALL_URL apuntando a tu WhatsApp (https://wa.me/52...)
// o tu Calendly. Por defecto abre un correo a soporte (funciona sin configurar).
export const CALL_URL =
  process.env.NEXT_PUBLIC_CALL_URL ||
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Quiero agendar una llamada — ChatVenti')}`

// Upsell de onboarding asistido (configuración 1-a-1 por videollamada). En USD,
// coherente con el resto del catálogo. El cobro/agenda es manual por ahora: el
// CTA lleva a CALL_URL para coordinar. Ajusta el precio aquí.
export const ONBOARDING_HELP_PRICE_USD = 39

// Etiqueta legible del negocio por rubro, para personalizar el copy del quiz.
// Deriva del catálogo único de verticales: era la 4ª copia de la taxonomía y
// se desincronizaba sola. `generico` y cualquier valor desconocido caen al
// genérico a propósito (el catálogo solo contiene giros con landing propia).
export function businessNoun(businessType: string | null | undefined): string {
  return verticalByBusinessType(businessType)?.noun ?? 'tu negocio'
}
