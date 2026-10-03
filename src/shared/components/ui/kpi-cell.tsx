import type { ReactNode } from 'react'

const TONES = {
  plain: 'bg-white text-ink',
  /** Algo salió mal y conviene revisarlo. */
  danger: 'bg-[#fde3e1] text-[#8f1714]',
} as const

/**
 * Cifra de contexto, como las cuatro del pie del Panel: etiqueta, número
 * tabular y una pista. Contexto, no tarea: nunca va arriba de lo que pide acción.
 */
export function KpiCell({
  label,
  value,
  unit,
  hint,
  tone = 'plain',
  testId,
  className = '',
}: {
  label: string
  value: ReactNode
  /** Sufijo pequeño junto al número («/ 5»). */
  unit?: string
  hint?: ReactNode
  tone?: keyof typeof TONES
  testId?: string
  className?: string
}) {
  const muted = tone === 'plain' ? 'text-ink-muted' : 'opacity-90'
  return (
    <div className={`rounded-[16px] px-4 py-3 shadow-[0_1px_0_#dde2f0] ${TONES[tone]} ${className}`}>
      <dt className={`text-[13px] font-semibold ${muted}`}>{label}</dt>
      <dd className="text-[1.6rem] font-bold leading-tight tabular-nums" data-testid={testId}>
        {value}
        {unit && <span className={`ml-1 text-[15px] font-semibold ${muted}`}>{unit}</span>}
      </dd>
      {hint && <dd className={`text-[12.5px] ${muted}`}>{hint}</dd>}
    </div>
  )
}
