import type { ReactNode } from 'react'
import { Icon, type IconName } from './icon'

/**
 * Estado vacío útil: dice qué aparecerá aquí, de dónde sale y cuál es el
 * siguiente paso. Borde punteado, como un tramo libre de la línea.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
  className = '',
}: {
  icon?: IconName
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  /** Dentro de una sección: sin borde propio y con menos aire. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-start gap-x-4 gap-y-3 ${
        compact ? 'rounded-[16px] bg-surface p-4' : 'rounded-[20px] border-2 border-dashed border-[#cfd4e6] bg-white p-5 md:p-6'
      } ${className}`}
    >
      {icon && (
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-brand-50 text-brand-600" aria-hidden>
          <Icon name={icon} className="h-[22px] w-[22px]" />
        </span>
      )}
      <div className="min-w-0 flex-1 basis-[15rem]">
        <p className="text-[17px] font-semibold leading-snug text-ink">{title}</p>
        {children && <div className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">{children}</div>}
        {action && <div className="mt-3.5 flex flex-wrap gap-2.5">{action}</div>}
      </div>
    </div>
  )
}
