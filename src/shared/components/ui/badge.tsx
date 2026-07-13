const VARIANTS = {
  success: 'bg-success-bg text-success',
  warn: 'bg-warn-bg text-warn',
  neutral: 'bg-surface text-ink-muted',
  brand: 'bg-brand-50 text-brand-700',
  danger: 'bg-red-50 text-red-700',
} as const

type BadgeProps = {
  children: React.ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
