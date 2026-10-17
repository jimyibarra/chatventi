// Piezas puras del prompt de la recepcionista (sin server-only: se prueban solas).

/**
 * Precio de un servicio tal como lo debe ver la IA. El texto del dueño
 * («Desde $250») manda; sin precio, «precio por confirmar» para que nunca lo
 * invente (pedido de PASEN, 17-oct-2026: sus servicios sugeridos llegan sin precio).
 */
export function servicePriceLabel(s: { price: number | null; price_text?: string | null }): string {
  if (s.price_text?.trim()) return s.price_text.trim()
  if (s.price != null) return `$${s.price.toLocaleString('en-US')}`
  return 'precio por confirmar'
}
