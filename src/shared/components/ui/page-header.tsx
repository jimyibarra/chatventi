import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from './icon'

const WIDTHS = {
  /** Panel, Agenda y pantallas con dos columnas. */
  wide: 'max-w-[1280px]',
  /** Listas (Chats, Clientes, Equipo…). */
  default: 'max-w-[1040px]',
  /** Formularios y lectura: un ancho de línea cómodo. */
  narrow: 'max-w-[820px]',
} as const

/** Contenedor de página del panel: mismo margen que el Panel y la Agenda. */
export function Page({
  children,
  width = 'default',
  className = '',
}: {
  children: ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}) {
  return <div className={`mx-auto ${WIDTHS[width]} px-4 pb-10 pt-4 md:px-6 md:pt-6 ${className}`}>{children}</div>
}

type PageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  /** Enlace de vuelta, encima del título («← Chats»). */
  back?: { href: string; label: string }
  /** Acciones de la página (la principal, al final). */
  actions?: ReactNode
  /** Contenido a la izquierda del título (un avatar). */
  lead?: ReactNode
}

/** Título de página 28 px/700 y subtítulo 15 px, como el Panel y la Agenda. */
export function PageHeader({ title, subtitle, back, actions, lead }: PageHeaderProps) {
  return (
    <header className="mb-5">
      {back && (
        <Link
          href={back.href}
          className="-ml-2 mb-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-[11px] px-2 text-[14.5px] font-semibold text-ink-muted transition-colors hover:bg-white hover:text-ink"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {lead}
        <div className="min-w-0 flex-1 basis-[16rem]">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-[70ch] text-[15px] leading-snug text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  )
}
