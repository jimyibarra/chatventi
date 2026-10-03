import Link from 'next/link'
import type { ReactNode } from 'react'

// Pantalla de error «Líneas» (404 y fallos). El dibujo es un tramo de línea:
// estaciones recorridas y, al final, la que no existe (hueca, con «?») o la que
// falló (roja, con equis). Sirve igual para un dueño que para el cliente final
// que abrió un enlace de reserva roto.

const W = 520
const END = 470

function LineArt({ kind, label }: { kind: 'missing' | 'failed'; label: string }) {
  return (
    <div className="relative mb-9 max-w-[520px]">
      <svg viewBox={`0 0 ${W} 72`} className="block h-auto w-full" aria-hidden>
        {/* tramo recorrido */}
        <path d="M14 36H306" stroke="#5b4fe0" strokeWidth="6" strokeLinecap="round" />
        {/* tramo punteado hacia la estación final */}
        <path d={`M330 36H${END - 28}`} stroke="#5b4fe0" strokeWidth="6" strokeLinecap="round" strokeDasharray="0.1 14" />
        {/* atendida */}
        <circle cx="40" cy="36" r="13" fill="#7d7996" stroke="#fff" strokeWidth="3" />
        <path d="m34 36.5 4 4 8-8.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* confirmadas */}
        <circle cx="156" cy="36" r="14" fill="#5b4fe0" stroke="#fff" strokeWidth="3.5" />
        <circle cx="272" cy="36" r="14" fill="#5b4fe0" stroke="#fff" strokeWidth="3.5" />
        {kind === 'missing' ? (
          <g className="cv-lost">
            <circle cx={END} cy="36" r="20" fill="#fff" stroke="#5b4fe0" strokeWidth="4.5" />
            <text x={END} y="44" textAnchor="middle" fontSize="23" fontWeight="700" fill="#2a1a5e" fontFamily="inherit">
              ?
            </text>
          </g>
        ) : (
          <g>
            <circle cx={END} cy="36" r="20" fill="#fff" stroke="#c5221f" strokeWidth="4.5" />
            <path d={`m${END - 7} 29 14 14m0-14-14 14`} stroke="#c5221f" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </svg>
      {/* Etiqueta de la estación final, como «Ahora» en el plano del Panel. En
          HTML y no dentro del SVG: así no se encoge con el dibujo en celular. */}
      <span
        className="absolute top-full -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink px-2.5 py-1 text-[12.5px] font-bold leading-none text-white"
        style={{ left: `${(END / W) * 100}%` }}
      >
        {label}
      </span>
    </div>
  )
}

export function ErrorScreen({
  kind,
  tag,
  title,
  children,
  actions,
  detail,
}: {
  kind: 'missing' | 'failed'
  tag: string
  title: string
  children: ReactNode
  actions: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="cv-panel flex min-h-screen flex-col bg-surface text-ink">
      <header className="bg-brand-500 px-4 py-2 text-white md:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-[10px] focus-visible:outline-white">
          {/* `loading="lazy"`: Next arma la 404 de antemano en cada página y, sin
              esto, React precarga el icono en TODAS (Chrome avisa en consola
              de una precarga que nadie usa). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/chatventi-icon.png" alt="" loading="lazy" className="h-8 w-8 rounded-[10px] bg-white p-1" />
          <span className="font-bold tracking-tight">ChatVenti</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[560px]">
          <LineArt kind={kind} label={tag} />
          <h1 className="text-balance text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-[2.4rem]">{title}</h1>
          <div className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-ink-muted">{children}</div>
          <div className="mt-7 flex flex-wrap gap-2.5">{actions}</div>
          {detail && <p className="mt-8 text-[13px] text-ink-muted">{detail}</p>}
        </div>
      </main>
    </div>
  )
}
