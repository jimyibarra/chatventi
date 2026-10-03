import '@/features/lineas/lineas.css'

// Plano de muestra para el panel de marca de acceso y alta: el mismo dibujo y
// las mismas estaciones que «El día en líneas» del Panel (lineas.css), con un
// día ilustrativo. Enseña la idea del producto antes de entrar: cada
// profesional es una línea y cada cita, una estación.

type Stop = { at: number; st: 'done' | 'noshow' | 'now' | 'ok' | 'wait' }
type Line = { name: string; color: string; stops: Stop[]; gap?: [number, number] }

const LINES: Line[] = [
  { name: 'Karla', color: '#e0007a', stops: [{ at: 8, st: 'done' }, { at: 29, st: 'done' }, { at: 54, st: 'now' }, { at: 82, st: 'ok' }] },
  { name: 'Luis', color: '#0b5bd3', stops: [{ at: 15, st: 'done' }, { at: 37, st: 'noshow' }, { at: 66, st: 'ok' }, { at: 91, st: 'wait' }] },
  { name: 'Sofía', color: '#007a45', stops: [{ at: 21, st: 'done' }, { at: 61, st: 'ok' }, { at: 88, st: 'wait' }], gap: [67, 82] },
]

const HOURS: [string, number][] = [
  ['9:00', 4],
  ['12:00', 36],
  ['15:00', 68],
  ['18:00', 96],
]

function Mark({ st }: { st: Stop['st'] }) {
  if (st === 'done') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    )
  }
  if (st === 'noshow') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
      </svg>
    )
  }
  return null
}

export function LinesShowcase() {
  return (
    <figure className="m-0 w-full max-w-[30rem]">
      <div className="ln rounded-card bg-white px-5 pb-12 pt-4 text-ink shadow-[0_28px_60px_-28px_rgba(20,10,60,.7)]" style={{ '--ln-label': '84px' } as React.CSSProperties}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-[15px] font-bold">El día en líneas</p>
          <span className="ln-chip" data-st="now">
            En curso
          </span>
        </div>
        <div className="ln-hours" aria-hidden>
          {HOURS.map(([h, at]) => (
            <span key={h} style={{ left: `${at}%` }}>
              {h}
            </span>
          ))}
        </div>
        <div className="relative" aria-hidden>
          {/* Marca de «ahora» que cruza las tres líneas. */}
          <div className="pointer-events-none absolute inset-y-0 left-[84px] right-0">
            <span className="ln-now" style={{ left: '54%' }}>
              <b>Ahora</b>
            </span>
          </div>
          {LINES.map((line, i) => (
            <div
              key={line.name}
              className="ln-in flex h-[54px] items-center"
              style={{ '--c': line.color, '--i': i } as React.CSSProperties}
            >
              <span className="flex w-[84px] flex-none items-center gap-2 pr-2">
                <span className="ln-badge">{line.name[0]}</span>
                <b className="truncate text-[14px] font-semibold">{line.name}</b>
              </span>
              <span className="relative h-full min-w-0 flex-1">
                <span className="ln-base" style={{ left: 0, right: 0 }} />
                {line.gap && <span className="ln-gap" style={{ left: `${line.gap[0]}%`, width: `${line.gap[1] - line.gap[0]}%` }} />}
                {line.stops.map((s) => (
                  <span key={s.at} className="ln-dot" data-st={s.st} style={{ left: `${s.at}%` }}>
                    <Mark st={s.st} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3.5 text-pretty text-[14.5px] leading-snug text-brand-50">
        Cada profesional es una línea y cada cita, una estación. Así se ve tu panel.
      </figcaption>
    </figure>
  )
}
