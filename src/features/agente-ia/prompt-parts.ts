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

/** Primera línea del prompt en un giro que no agenda (restaurante). */
export const NO_BOOKING_HEADER =
  'IMPORTANTE: ESTE NEGOCIO NO AGENDA CITAS. No ofrezcas, propongas ni confirmes horarios de citas, aunque otras instrucciones o mensajes anteriores hablen de agendar.'

/** Lo que dice la recepcionista si, aun así, intentó ofrecer horarios. */
export const NO_BOOKING_REPLY =
  'Aquí no agendamos citas 🙂 Con gusto te ayudo con el menú, los precios, el horario o tu pedido. ¿Qué se te antoja?'

/**
 * ¿La respuesta ofrece horarios para una cita? Pide las dos cosas: una hora
 * (9:00, 4:30 pm) y una palabra de agenda; así «abrimos de 9:00 a 18:00» pasa.
 */
export function offersAppointmentSlots(text: string): boolean {
  return /\b\d{1,2}:\d{2}\b/.test(text) && /(agend|\bcitas?\b|reserv|horarios? (disponibles?|para))/i.test(text)
}
