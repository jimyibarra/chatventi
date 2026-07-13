import { STATUS_LABELS } from '@/features/billing/plans'

// Estilos por estado de suscripción (sobre fondo oscuro del panel admin).
const STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  trialing: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  past_due: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  unpaid: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  canceled: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  incomplete: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  none: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
}

export function OrgStatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? STYLES.none
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
