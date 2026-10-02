/**
 * Datos legales y de marca centralizados.
 * Ajusta AQUÍ razón social y correo de contacto (se reflejan en la landing,
 * la política de privacidad y los términos). Necesarios para la revisión de Meta.
 */
export const LEGAL = {
  brand: 'ChatVenti',
  // Razón social del operador y responsable del tratamiento (confirmada 2026-10-02).
  legalName: 'Grupo ELRI SA de CV',
  domain: 'chatventi.com',
  // Host CANÓNICO = www. El apex responde 308 → https://www.chatventi.com/
  // (verificado en producción 2026-08-04). Usar el apex aquí hacía que el
  // JSON-LD, los canonical y las URLs de OpenGraph apuntaran a una redirección.
  siteUrl: 'https://www.chatventi.com',
  // Correo real (buzón hola@ con alias soporte@ en Hostinger). Funciona para Meta.
  contactEmail: 'soporte@chatventi.com',
  privacyEmail: 'soporte@chatventi.com',
  lastUpdated: '2 de octubre de 2026',
  // Versión de los Términos que el usuario acepta al registrarse (click-wrap).
  // Súbela cuando cambie el contenido legal para forzar re-aceptación futura.
  // 2026-10-02: los Términos y la Privacidad nombran al operador por su razón social.
  termsVersion: '2026-10-02',
} as const
