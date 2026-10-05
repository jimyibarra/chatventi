import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import type { TemplateState } from '../service'

// Estado de una plantilla en Meta. «Falta» es lo único en amarillo: es lo
// único que se resuelve desde ChatVenti (pidiéndola a Meta).
const LOOK: Record<TemplateState, { tone: ChipTone; label: string }> = {
  approved: { tone: 'ok', label: 'Aprobada' },
  pending: { tone: 'neutral', label: 'En revisión' },
  rejected: { tone: 'noshow', label: 'Rechazada' },
  paused: { tone: 'off', label: 'En pausa' },
  missing: { tone: 'wait', label: 'Falta' },
}

export function TemplateChip({ state, reason }: { state: TemplateState; reason?: string | null }) {
  const look = LOOK[state]
  return (
    <StatusChip tone={look.tone} title={reason ?? undefined}>
      {look.label}
    </StatusChip>
  )
}
