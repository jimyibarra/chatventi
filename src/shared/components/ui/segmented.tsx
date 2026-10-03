import Link from 'next/link'
import type { ReactNode } from 'react'

// Selector de vistas o filtros, el mismo de la Agenda (Día / Semana): pista
// gris azulada y la opción activa en tinta.
export const SEGMENT_GROUP = 'inline-flex max-w-full flex-wrap gap-1 rounded-[16px] bg-[#e3e6f3] p-1'

/** Variante para muchas opciones: en celular se desliza de lado en vez de apilarse en tres filas. */
export const SEGMENT_SCROLL =
  'flex max-w-full gap-1 overflow-x-auto rounded-[16px] bg-[#e3e6f3] p-1 [scrollbar-width:none] sm:inline-flex [&::-webkit-scrollbar]:hidden'

export function segmentItem(active: boolean): string {
  return `inline-flex min-h-[44px] flex-none items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold transition-colors duration-150 md:min-h-[40px] ${
    active ? 'bg-ink text-white' : 'text-ink hover:bg-white/70'
  }`
}

/** Filtro por enlace (conserva la URL compartible): `?seg=vip`. */
export function SegmentLink({
  href,
  active,
  children,
  count,
}: {
  href: string
  active: boolean
  children: ReactNode
  count?: number
}) {
  return (
    <Link href={href} className={segmentItem(active)} aria-current={active ? 'true' : undefined} scroll={false}>
      {children}
      {count !== undefined && (
        <span
          className={`min-w-[1.5rem] rounded-full px-1.5 text-center text-[12.5px] font-bold tabular-nums ${
            active ? 'bg-white/20 text-white' : 'bg-white text-ink-muted'
          }`}
        >
          {count.toLocaleString('en-US')}
        </span>
      )}
    </Link>
  )
}
