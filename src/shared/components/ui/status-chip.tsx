import type { ReactNode } from 'react'

// Chip de estado «Líneas» (21 px, radio completo). El estado se lee por la
// FORMA de su marca además del color: aro hueco = espera, punto = hecho,
// palomita = atendido, equis = no llegó. Funciona para daltónicos y al sol.
const TONES = {
  /** Espera una acción tuya («Sin confirmar»). El único amarillo. */
  wait: 'bg-[#ffcd2e] text-ink',
  /** Bien / confirmado / activo. */
  ok: 'bg-[#d6f5e3] text-[#0b5d36]',
  /** En curso, ahora mismo. */
  now: 'bg-ink text-white',
  /** Terminado, atendido. */
  done: 'bg-[#e7e6f0] text-ink-muted',
  /** No llegó, rechazado, fallo. */
  noshow: 'bg-[#fde3e1] text-[#a51b18]',
  /** Información sin carga (un rol, un canal). */
  neutral: 'bg-[#e7e6f0] text-ink-muted',
  /** Distintivo de marca (tu plan, «Más popular»). */
  brand: 'bg-brand-100 text-brand-800',
  /** Apagado o en pausa. */
  off: 'bg-transparent text-ink-muted shadow-[inset_0_0_0_1.5px_#c9cde0]',
} as const

export type ChipTone = keyof typeof TONES

function Mark({ tone }: { tone: ChipTone }) {
  if (tone === 'wait') return <i className="h-2 w-2 flex-none rounded-full border-[1.5px] border-current" aria-hidden />
  if (tone === 'ok') return <i className="h-2 w-2 flex-none rounded-full bg-current" aria-hidden />
  if (tone === 'now') {
    return <i className="h-[7px] w-[7px] flex-none animate-pulse rounded-full bg-[#4ade80] motion-reduce:animate-none" aria-hidden />
  }
  if (tone === 'done' || tone === 'noshow') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={tone === 'done' ? 'm5 12.5 4.5 4.5L19 7.5' : 'm6.5 6.5 11 11M17.5 6.5l-11 11'} />
      </svg>
    )
  }
  if (tone === 'off') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
        <path d="M9 6v12M15 6v12" />
      </svg>
    )
  }
  return null
}

export function StatusChip({
  tone = 'neutral',
  children,
  icon,
  className = '',
  title,
  testId,
  size = 'sm',
}: {
  tone?: ChipTone
  children: ReactNode
  /** `sm` (21 px) en filas; `md` (28 px) junto a un título o en una cabecera. */
  size?: 'sm' | 'md'
  /** Sustituye la marca de forma por un icono propio (un canal, por ejemplo). */
  icon?: ReactNode
  className?: string
  title?: string
  testId?: string
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-[5px] whitespace-nowrap rounded-full align-middle font-semibold leading-none ${
        size === 'md' ? 'h-7 px-3 text-[13px]' : 'h-[21px] px-2 text-[11.5px]'
      } ${TONES[tone]} ${className}`}
      title={title}
      data-testid={testId}
    >
      {icon ?? <Mark tone={tone} />}
      <span className="truncate">{children}</span>
    </span>
  )
}
