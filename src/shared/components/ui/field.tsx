import type { ComponentProps, ReactNode } from 'react'

// Controles de formulario «Líneas»: el mismo radio (13 px) y alto (44/40 px)
// que los botones, borde de 2 px y foco visible de marca. CONTROL no fija el
// ancho: los componentes de abajo ocupan su contenedor (w-full); quien use la
// clase suelta pone el suyo (w-full, w-28…).
export const CONTROL =
  'block rounded-[13px] border-2 border-[#d6dbec] bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 hover:border-[#bfc5dd] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-ink-muted motion-reduce:transition-none'

/** Alto de una línea (input y select). */
export const CONTROL_H = 'min-h-[44px] md:min-h-[40px]'

/** Etiqueta de un campo (13.5 px/600), para formularios que no usan <Field>. */
export const FIELD_LABEL = 'mb-1.5 block text-[13.5px] font-semibold text-ink'

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`${CONTROL} ${CONTROL_H} w-full ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea className={`${CONTROL} w-full py-2.5 leading-relaxed ${className}`} {...props} />
}

/** Select nativo con flecha propia. `wrapperClassName` controla el ancho. */
export function Select({ className = '', wrapperClassName = '', children, ...props }: ComponentProps<'select'> & { wrapperClassName?: string }) {
  return (
    <span className={`relative block ${wrapperClassName}`}>
      <select className={`${CONTROL} ${CONTROL_H} w-full cursor-pointer appearance-none pr-10 ${className}`} {...props}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}

/**
 * Interruptor: es un checkbox de verdad (conserva `checked`, `onChange` y el
 * `data-testid`), dibujado como palanca. Encendido = verde y bolita a la derecha.
 */
export function Switch({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={`relative h-[26px] w-[46px] flex-none cursor-pointer appearance-none rounded-full bg-[#c9cde0] transition-colors duration-200 before:absolute before:left-[3px] before:top-[3px] before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(42,26,94,.35)] before:transition-transform before:duration-200 before:content-[''] checked:bg-[#0d9463] checked:before:translate-x-5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:before:transition-none ${className}`}
      {...props}
    />
  )
}

/** Mensaje de validación bajo un campo. Dale `id` y apúntalo con `aria-describedby`. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="mt-1.5 block text-[13px] font-medium leading-snug text-[#a51b18]">
      {children}
    </span>
  )
}

/** Casilla nativa con el color de marca. */
export const CHECKBOX = 'h-[18px] w-[18px] flex-none cursor-pointer rounded accent-brand-500'

type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  /**
   * `label` (por defecto) envuelve un único control y lo nombra. Usa `div`
   * cuando dentro hay varios botones (una subida de imagen, un grupo de chips).
   */
  as?: 'label' | 'div'
}

export function Field({ label, hint, children, className = '', as = 'label' }: FieldProps) {
  const El = as
  return (
    <El className={`block min-w-0 ${className}`}>
      <span className={FIELD_LABEL}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-ink-muted">{hint}</span>}
    </El>
  )
}
