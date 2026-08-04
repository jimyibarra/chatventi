// =====================================================================
// Correo canónico — identidad única de una bandeja de entrada.
//
// juan+1@gmail.com, juan+2@gmail.com y j.u.a.n@gmail.com son LA MISMA
// bandeja. Sin esto, un correo gratuito da pruebas gratis infinitas.
//
// Debe devolver exactamente lo mismo que la función SQL canonical_email()
// (migración 20260803000000). Si tocas una, toca la otra: la de SQL sella el
// dato al crear el perfil y la de TS decide antes de llegar ahí.
// =====================================================================

/** Dominios donde los puntos del nombre son irrelevantes por diseño. */
const DOT_INSENSITIVE_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * Reduce un correo a su identidad canónica.
 *
 * - minúsculas y sin espacios
 * - se recorta `+etiqueta` en TODOS los dominios
 * - los puntos SOLO se colapsan en Gmail: en un dominio corporativo
 *   `a.b@empresa.com` y `ab@empresa.com` son personas distintas, y
 *   colapsarlos bloquearía a un cliente legítimo.
 *
 * Devuelve `null` si no parece un correo (quien llama decide qué hacer).
 */
export function canonicalEmail(email: string | null | undefined): string | null {
  const raw = (email ?? '').trim().toLowerCase()
  const at = raw.indexOf('@')
  // at > 0 exige parte local; y debe ser la única arroba.
  if (at <= 0 || raw.indexOf('@', at + 1) !== -1) return null

  const localRaw = raw.slice(0, at)
  const domainRaw = raw.slice(at + 1)
  if (!localRaw || !domainRaw || !domainRaw.includes('.')) return null

  const local = localRaw.split('+')[0]
  const domain = domainRaw === 'googlemail.com' ? 'gmail.com' : domainRaw
  if (!local) return null

  if (DOT_INSENSITIVE_DOMAINS.has(domainRaw)) {
    const withoutDots = local.replaceAll('.', '')
    return withoutDots ? `${withoutDots}@gmail.com` : null
  }
  return `${local}@${domain}`
}
