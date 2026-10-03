import type { ReactNode } from 'react'
import { Icon, type IconName } from './icon'

// Avisos dentro de una pantalla. El amarillo («action») es solo para lo que
// espera algo de ti; lo informativo va en violeta claro.
const TONES: Record<NoticeTone, { box: string; tile: string; icon: IconName }> = {
  action: { box: 'bg-[#ffcd2e] text-ink', tile: 'bg-ink text-[#ffcd2e]', icon: 'bell' },
  info: { box: 'bg-brand-50 text-brand-900', tile: 'bg-brand-500 text-white', icon: 'info' },
  success: { box: 'bg-[#d6f5e3] text-[#0b5d36]', tile: 'bg-[#0d9463] text-white', icon: 'check' },
  danger: { box: 'bg-[#fde3e1] text-[#8f1714]', tile: 'bg-[#c5221f] text-white', icon: 'alert' },
}

export type NoticeTone = 'action' | 'info' | 'success' | 'danger'

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  icon,
  size = 'md',
  className = '',
  testId,
}: {
  tone?: NoticeTone
  title?: ReactNode
  children?: ReactNode
  /** Botón o enlace que resuelve el aviso. */
  action?: ReactNode
  icon?: IconName
  /** `sm`: mensaje de un formulario («Guardado», un error). */
  size?: 'md' | 'sm'
  className?: string
  testId?: string
}) {
  const t = TONES[tone]
  const sm = size === 'sm'
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[16px] ${sm ? 'px-3 py-2.5 text-sm' : 'p-3.5 text-[14.5px] md:px-4'} ${t.box} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      data-testid={testId}
    >
      <span className={`grid flex-none place-items-center ${sm ? 'h-6 w-6 rounded-[8px]' : 'h-8 w-8 rounded-[10px]'} ${t.tile}`} aria-hidden>
        <Icon name={icon ?? t.icon} className={sm ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1 basis-[14rem] leading-snug">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}
