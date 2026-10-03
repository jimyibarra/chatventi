import type { HTMLAttributes, ReactNode } from 'react'

/** Sombra corta de las tarjetas «Líneas». Sin bordes grises. */
export const CARD_SHADOW = 'shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)]'

const TONES = {
  white: `bg-white text-ink ${CARD_SHADOW}`,
  /** Énfasis: la recepcionista y los totales. Texto blanco. */
  ink: 'bg-ink text-white',
  /** Solo para lo que espera una acción (como «Avisos»). */
  alert: 'bg-[#ffcd2e] text-ink',
} as const

type CardTone = keyof typeof TONES
type Tag = 'div' | 'section' | 'li' | 'article' | 'aside'

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  tone?: CardTone
  as?: Tag
  /** Relleno interior estándar (16 px; 20 px desde md). */
  padded?: boolean
  /** Realza la tarjeta al pasar el ratón (tarjetas clicables). */
  hover?: boolean
}

export function Card({ children, tone = 'white', as: El = 'div', padded = true, hover = false, className = '', ...rest }: CardProps) {
  return (
    <El
      className={`rounded-card ${TONES[tone]} ${padded ? 'p-4 md:p-5' : ''} ${
        hover ? 'transition-shadow duration-200 hover:shadow-[0_1px_0_#dde2f0,0_14px_30px_-12px_rgba(42,26,94,.3)]' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </El>
  )
}

type SectionProps = Omit<CardProps, 'title' | 'as'> & {
  title: ReactNode
  description?: ReactNode
  /** Acciones de la sección, a la derecha del título (abajo en celular). */
  actions?: ReactNode
  /** Distintivo junto al título: un contador o un chip de estado. */
  badge?: ReactNode
}

/** Tarjeta con título de sección (18 px/700), descripción opcional y acciones. */
export function Section({ title, description, actions, badge, tone = 'white', children, ...rest }: SectionProps) {
  const muted = tone === 'ink' ? 'text-[#dcd8f7]' : 'text-ink-muted'
  return (
    <Card as="section" tone={tone} aria-label={typeof title === 'string' ? title : undefined} {...rest}>
      <div className="mb-3.5 flex flex-wrap items-start gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-[14rem]">
          <h2 className="flex flex-wrap items-center gap-2 text-[1.15rem] font-bold leading-tight">
            {title}
            {badge}
          </h2>
          {description && <p className={`mt-1 max-w-[68ch] text-[14.5px] leading-snug ${muted}`}>{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

/** Subtítulo dentro de una sección (14.5 px/700). `className` sustituye el margen por defecto. */
export function SubHeading({ children, className = 'mb-2' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[14.5px] font-bold text-ink ${className}`}>{children}</h3>
}

/** Zona rebajada dentro de una tarjeta (un formulario que se despliega, una vista previa). No es otra tarjeta. */
export function Inset({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[16px] bg-surface p-3.5 md:p-4 ${className}`}>{children}</div>
}
