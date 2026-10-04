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

/**
 * `includedIn` = nombre del socio interno (PASEN) cuyo paquete incluye este
 * negocio: activo, pero no le paga a ChatVenti.
 */
export function OrgStatusBadge({ status, includedIn }: { status: string; includedIn?: string }) {
  if (includedIn && status === 'active') return <StatusChip tone="brand">{`Incluido en ${includedIn}`}</StatusChip>
  return <StatusChip tone={TONES[status] ?? 'neutral'}>{STATUS_LABELS[status] ?? status}</StatusChip>
}
