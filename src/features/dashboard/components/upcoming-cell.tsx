import Link from 'next/link'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import type { PanelMetrics } from '../metrics'

export function UpcomingCell({ proximas }: { proximas: PanelMetrics['proximas'] }) {
  return (
    <Card className="flex flex-col p-[18px]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Próximas citas</h2>
        <Link
          href="/dashboard/agenda"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Ver agenda →
        </Link>
      </div>
      {proximas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-soft">
          Sin citas próximas. Cuando la IA o tú agenden una, aparecerá aquí.
        </p>
      ) : (
        <ul>
          {proximas.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 border-b border-line-row py-2.5 last:border-none last:pb-0"
            >
              <span className="w-11 text-[13px] font-bold text-brand-600 tabular-nums">
                {a.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {a.clientName}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">{a.serviceName}</span>
              </span>
              <Badge variant={a.confirmed ? 'success' : 'warn'}>
                {a.confirmed ? 'Confirmada' : 'Pendiente'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
