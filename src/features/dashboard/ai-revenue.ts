// =====================================================================
// "El dinero que trajo la IA": citas que agendó la recepcionista y lo que
// valen según el precio de sus servicios. Lo usan el Panel y el resumen diario.
//
// Una cita cuenta como "de la IA" cuando su origen es un canal de chat: ahí
// solo agenda el agente (el personal agenda desde el panel → 'staff'; la
// página de reservas → 'web').
// =====================================================================

export const AI_SOURCES = ['whatsapp', 'telegram', 'instagram', 'messenger', 'ai']

export type AiBookingRow = {
  id: string
  appointment_services: { service: { price: number | string | null } | null }[] | null
}

export function sumAiBookings(rows: AiBookingRow[]): { citas: number; importe: number } {
  let importe = 0
  for (const row of rows) {
    for (const line of row.appointment_services ?? []) {
      importe += Number(line.service?.price ?? 0) || 0
    }
  }
  return { citas: rows.length, importe }
}
