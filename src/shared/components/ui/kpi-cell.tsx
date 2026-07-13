import { Card } from './card'

type KpiCellProps = {
  label: string
  value: string | number
  /** Texto del delta, p. ej. "▲ 3 vs ayer". */
  delta?: string
  deltaTone?: 'success' | 'warn'
  /** Alturas relativas 0–1 del sparkline; la última barra se resalta. */
  spark?: number[]
  testId?: string
}

export function KpiCell({ label, value, delta, deltaTone = 'success', spark, testId }: KpiCellProps) {
  return (
    <Card hover className="p-[18px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-faint">
        {label}
      </p>
      <p
        className="mt-1.5 text-3xl font-extrabold tracking-tight text-ink tabular-nums"
        data-testid={testId}
      >
        {value}
      </p>
      {delta && (
        <p
          className={`mt-0.5 text-[11.5px] font-semibold ${
            deltaTone === 'success' ? 'text-success' : 'text-warn-strong'
          }`}
        >
          {delta}
        </p>
      )}
      {spark && spark.length > 0 && (
        <div className="mt-3 flex h-[30px] items-end gap-[3px]">
          {spark.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-[3px] ${
                i === spark.length - 1 ? 'bg-brand-500' : 'bg-brand-100'
              }`}
              style={{ height: `${Math.max(8, Math.min(1, h) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
