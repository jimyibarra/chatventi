import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps } from 'react'

// Botones «Líneas»: radio 13 px, 44 px de alto al tacto y 40 px con ratón.
// Primario relleno de marca; secundario blanco con borde de tinta de 2 px.
const VARIANTS = {
  primary: 'bg-brand-500 text-white shadow-btn hover:bg-brand-600',
  secondary: 'border-2 border-ink bg-white text-ink hover:bg-brand-50',
  ghost: 'text-ink hover:bg-brand-50',
  danger: 'text-[#a51b18] hover:bg-[#fde3e1]',
  /** Sobre la tarjeta de tinta (fondo oscuro). */
  inverse: 'border-2 border-white text-white hover:bg-white/15',
} as const

const SIZES = {
  md: 'min-h-[44px] px-4 text-[15px] md:min-h-[40px]',
  sm: 'min-h-[44px] px-3 text-sm md:min-h-[36px]',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[13px] font-semibold transition-[background-color,transform,box-shadow] duration-150 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none'

/** Clases de botón para elementos que no son <Button> (un <a> de descarga, un <label>). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }

/** Enlace con apariencia de botón (para acciones que navegan dentro del panel). */
export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...props }: ButtonLinkProps) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />
}
