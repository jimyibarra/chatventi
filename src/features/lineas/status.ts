import type { ChipTone } from '@/shared/components/ui/status-chip'

// Estado de una cita (columna `status`) → chip «Líneas». Mismos nombres que
// las estaciones del plano (STATE_LABEL), para que la cita diga lo mismo en
// la Agenda, en el diálogo y en la ficha del cliente.
const APPT_CHIP: Record<string, { tone: ChipTone; label: string }> = {
  scheduled: { tone: 'wait', label: 'Sin confirmar' },
  confirmed: { tone: 'ok', label: 'Confirmada' },
  completed: { tone: 'done', label: 'Atendida' },
  no_show: { tone: 'noshow', label: 'No asistió' },
  cancelled: { tone: 'neutral', label: 'Cancelada' },
}

export function apptChip(status: string): { tone: ChipTone; label: string } {
  return APPT_CHIP[status] ?? { tone: 'neutral', label: status }
}
