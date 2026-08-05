import { z } from 'zod'

// =====================================================================
// Encuesta de satisfacción (Fase 4). El botón viaja como
// "csat:<appointment_id>:<score>" y se resuelve EN EL WEBHOOK, sin
// despertar al LLM — mismo molde que "conf:" (confirmar asistencia).
// =====================================================================

const uuidSchema = z.string().uuid()

export type CsatButton = { appointmentId: string; score: number }

/** Devuelve la cita y la nota, o null si el id no es un botón de encuesta. */
export function parseCsatButton(buttonId: string | null | undefined): CsatButton | null {
  if (!buttonId?.startsWith('csat:')) return null
  const [, rawId, rawScore] = buttonId.split(':')
  if (!uuidSchema.safeParse(rawId).success) return null
  const score = Number(rawScore)
  if (!Number.isInteger(score) || score < 1 || score > 5) return null
  return { appointmentId: rawId as string, score }
}

/**
 * Respuesta al cliente. Se agradece siempre igual, pero una nota baja no se
 * despacha con un "¡gracias!": se le dice que alguien va a mirarlo.
 */
export function csatReply(score: number): string {
  if (score <= 2) {
    return 'Gracias por decírnoslo 🙏 Sentimos que no haya salido bien. Le pasamos tu comentario al equipo para que lo revise.'
  }
  if (score === 3) {
    return '¡Gracias por tu opinión! 🙌 Nos ayuda a mejorar.'
  }
  return '¡Gracias por calificarnos! 🤩 Nos alegra que te haya gustado.'
}

/** Texto cuando la calificación ya estaba registrada (doble pulsación). */
export const CSAT_ALREADY = 'Ya habíamos recibido tu opinión. ¡Gracias! 🙌'
