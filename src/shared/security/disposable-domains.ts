// =====================================================================
// Dominios de correo desechable.
//
// Lista estática a propósito (KISS): un servicio externo en el camino del
// alta añade latencia y un punto de fallo justo donde más duele. Ampliarla
// es un commit de una línea.
//
// Cubre los servicios más usados y sus alias conocidos. No pretende ser
// exhaustiva: es un filtro de coste cero contra el abuso perezoso, no una
// frontera infranqueable. Las capas que de verdad sostienen el peso son el
// límite de tasa y el tope de consumo.
// =====================================================================

const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'byom.de',
  'dispostable.com',
  'disposablemail.com',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'inboxbear.com',
  'incognitomail.com',
  'jetable.org',
  'mail-temporaire.fr',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mailsac.com',
  'mailtemp.net',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'nowmymail.com',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.dev',
  'tempmail.plus',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'wegwerfmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
])

/** ¿El dominio del correo es de un buzón desechable conocido? */
export function isDisposableEmail(email: string | null | undefined): boolean {
  const raw = (email ?? '').trim().toLowerCase()
  const at = raw.lastIndexOf('@')
  if (at <= 0) return false
  const domain = raw.slice(at + 1)
  if (!domain) return false
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  // Muchos servicios reparten subdominios (p. ej. inbox.mailinator.com).
  return [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`))
}
