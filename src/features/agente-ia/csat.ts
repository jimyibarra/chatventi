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

/** Lo que devuelve la RPC record_csat. */
export type CsatInfo = {
  conversation_id?: string | null
  duplicate?: boolean
  review_url?: string | null
  org_name?: string | null
  contact_email?: string | null
  client_name?: string | null
}

/**
 * Respuesta completa a quien contestó la encuesta: el agradecimiento y, si el
 * negocio configuró su enlace, la invitación a dejar una reseña en Google.
 *
 * 🔴 El enlace va a TODOS, con la misma frase, saque la nota que saque. Pedir
 * reseñas solo a los contentos ("review gating") está prohibido por Google y
 * sancionado por la FTC en EE. UU. No añadir aquí un `if (score >= 4)`.
 */
export function csatMessage(score: number, info: CsatInfo | null): string {
  const thanks = csatReply(score)
  return info?.review_url
    ? `${thanks}\n\nSi quieres contar tu experiencia en Google, aquí puedes hacerlo: ${info.review_url}`
    : thanks
}

/** Texto cuando la calificación ya estaba registrada (doble pulsación). */
export const CSAT_ALREADY = 'Ya habíamos recibido tu opinión. ¡Gracias! 🙌'
