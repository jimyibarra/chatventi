import { StatusChip, type ChipTone } from './status-chip'

// Alias histórico: las variantes del Bento Grid se traducen a los chips «Líneas».
const VARIANTS: Record<'success' | 'warn' | 'neutral' | 'brand' | 'danger', ChipTone> = {
  success: 'ok',
  warn: 'wait',
  neutral: 'neutral',
  brand: 'brand',
  danger: 'noshow',
}

type BadgeProps = {
  children: React.ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <StatusChip tone={VARIANTS[variant]} className={className}>
      {children}
    </StatusChip>
  )
}
