import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-brand-500 text-white shadow-btn hover:bg-brand-600',
  secondary: 'border border-line bg-white text-ink hover:border-brand-200 hover:shadow-card-hover',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
} as const

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50'

type Variant = keyof typeof VARIANTS

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }

/** Enlace con apariencia de botón (para CTAs que navegan). */
export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return <a className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
}
