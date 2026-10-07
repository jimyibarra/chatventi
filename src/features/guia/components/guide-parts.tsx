import type { ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@/shared/components/ui/icon'
import { CHATVENTI, type Brand } from '@/features/marca/brand-shared'

// Piezas de las guías públicas (/ayuda/*): la guía es una línea del Metro y
// cada paso es una estación con su color.
const LINE = ['#e0007a', '#0b5bd3', '#00a35c', '#5b4fe0', '#f08c00']

/** Barra de las guías: logo a la home (o al panel del socio) y atajo a Conexiones. */
export function GuideTop({ brand = CHATVENTI }: { brand?: Brand }) {
  return (
    <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-4 py-4 md:px-6">
      <Link href={brand.panelUrl ?? '/'} className="flex items-center gap-2 rounded-[12px] font-bold tracking-tight text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.iconUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-[10px] bg-white p-1 shadow-[0_1px_0_#dde2f0]" />
        {brand.name}
      </Link>
      <Link href="/dashboard/conexiones" className="inline-flex min-h-[44px] items-center rounded-[13px] border-2 border-ink bg-white px-4 text-[15px] font-semibold text-ink hover:bg-brand-50 md:min-h-[40px]">
        Ir a Conexiones
      </Link>
    </header>
  )
}

/** «Si algo no sale»: preguntas desplegables y el correo de soporte. */
export function GuideFaq({ items, supportEmail = CHATVENTI.supportEmail }: { items: { q: string; a: ReactNode }[]; supportEmail?: string }) {
  return (
    <section aria-labelledby="faq-t" className="mt-16 max-w-[48rem]">
      <h2 id="faq-t" className="text-[1.45rem] font-bold tracking-tight text-ink md:text-[1.75rem]">
        Si algo no sale
      </h2>
      <div className="mt-4 divide-y divide-line rounded-[20px] bg-white px-4 shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)] md:px-5">
        {items.map((f) => (
          <details key={f.q} className="group py-1">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">{f.q}</span>
              <Icon name="chevronDown" className="h-5 w-5 flex-none text-ink-muted transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-[15.5px] leading-relaxed text-ink-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-[15px] text-ink-muted">
        ¿Te atoraste en otro paso? Escríbenos a <span className="font-semibold text-ink">{supportEmail}</span> y te ayudamos.
      </p>
    </section>
  )
}

export function Station({
  n,
  id,
  title,
  lead,
  children,
  shots,
  shotsBelow = false,
  stack = false,
  last = false,
}: {
  n: number
  id: string
  title: string
  lead: string
  children: ReactNode
  shots?: ReactNode
  /** Capturas en fila debajo del texto (una secuencia), en vez de a un lado. */
  shotsBelow?: boolean
  /** Capturas una debajo de otra (para que no aprieten el texto). */
  stack?: boolean
  last?: boolean
}) {
  const color = LINE[n - 1]
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="relative grid scroll-mt-6 grid-cols-[44px_minmax(0,1fr)] gap-x-4 md:grid-cols-[56px_minmax(0,1fr)]">
      {/* Tramo de la línea y estación */}
      <div className="relative flex justify-center" aria-hidden>
        {!last && <span className="absolute bottom-[-8px] top-11 w-[7px] rounded-full md:top-14" style={{ background: color }} />}
        <span
          className="relative z-10 grid h-11 w-11 place-items-center rounded-full border-[6px] bg-white text-[17px] font-bold text-ink md:h-14 md:w-14 md:text-[20px]"
          style={{ borderColor: color }}
        >
          {n}
        </span>
      </div>
      <div className={`min-w-0 ${last ? '' : 'pb-12 md:pb-16'}`}>
        <h2 id={`${id}-t`} className="pt-1.5 text-[1.45rem] font-bold leading-tight tracking-tight text-ink [text-wrap:balance] md:pt-2.5 md:text-[1.75rem]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[16px] leading-relaxed text-ink-muted">{lead}</p>
        {shotsBelow ? (
          <div className="mt-5 space-y-7">
            <div className="min-w-0 max-w-[44rem] space-y-4">{children}</div>
            <div className="grid grid-cols-1 items-start gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{shots}</div>
          </div>
        ) : (
          <div className={`mt-5 grid items-start gap-7 ${shots ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
            <div className="min-w-0 space-y-4">{children}</div>
            {shots && <div className={`flex justify-center gap-6 ${stack ? 'flex-col items-center' : 'flex-wrap'}`}>{shots}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

/** Pasos de una pantalla, en orden. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-[16px] leading-relaxed text-ink">
          <span className="mt-[3px] grid h-[26px] w-[26px] place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  )
}

/** Ruta de menús tal como se lee en pantalla: Menú › Páginas › Crear. */
export function Path({ parts }: { parts: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-1">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-ink-muted" />}
          <span className="rounded-[8px] bg-white px-2 py-0.5 text-[14.5px] font-semibold text-ink shadow-[0_1px_0_#dde2f0]">{p}</span>
        </span>
      ))}
    </span>
  )
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2.5 rounded-[16px] bg-brand-50 px-4 py-3 text-[15px] leading-relaxed text-brand-900">
      <Icon name="lightbulb" className="mt-0.5 h-5 w-5 flex-none" />
      <span>{children}</span>
    </p>
  )
}
