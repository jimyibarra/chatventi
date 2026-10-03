import { STATUS_LABELS } from '@/features/billing/plans'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'

// Estado de la suscripción → chip «Líneas». La forma dice el estado además del
// color: punto = cobrando, equis = el cobro falló, pausa = sin suscripción.
const TONES: Record<string, ChipTone> = {
  active: 'ok',
  trialing: 'brand',
  past_due: 'noshow',
  unpaid: 'noshow',
  canceled: 'off',
  incomplete: 'neutral',
  none: 'off',
}

export function OrgStatusBadge({ status }: { status: string }) {
  return <StatusChip tone={TONES[status] ?? 'neutral'}>{STATUS_LABELS[status] ?? status}</StatusChip>
}
