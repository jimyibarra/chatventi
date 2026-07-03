/**
 * Datos legales y de marca centralizados.
 * Ajusta AQUÍ razón social y correo de contacto (se reflejan en la landing,
 * la política de privacidad y los términos). Necesarios para la revisión de Meta.
 */
export const LEGAL = {
  brand: 'ChatVenti',
  // TODO(confirmar): razón social del operador. Si se deja así, aplica la marca.
  legalName: 'ChatVenti',
  domain: 'chatventi.com',
  siteUrl: 'https://chatventi.com',
  // Correo real (buzón hola@ con alias soporte@ en Hostinger). Funciona para Meta.
  contactEmail: 'soporte@chatventi.com',
  privacyEmail: 'soporte@chatventi.com',
  lastUpdated: '3 de julio de 2026',
} as const
