'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { AppointmentView } from '@/features/agenda/types'
import { STATE_LABEL, hhmm, type DayModel, type Line, type Station, type StationState } from '../model'
import '../lineas.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

function StateIcon({ state }: { state: StationState }) {
  if (state === 'done') return <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  if (state === 'noshow') return <svg viewBox="0 0 24 24" aria-hidden><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></svg>
  return null
}

export function Legend() {
  const items: [StationState, string][] = [
    ['wait', 'Sin confirmar'],
    ['ok', 'Confirmada'],
    ['now', 'En curso'],
    ['done', 'Atendida'],
    ['noshow', 'No asistió'],
  ]
  return (
    <ul className="ln mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-4 text-[13px] text-ink-muted" style={{ '--c': '#5b4fe0' } as Vars}>
      {items.map(([st, label]) => (
        <li key={st} className="flex items-center gap-2.5">
          <i className="ln-dot" data-st={st} style={{ position: 'static', margin: 0, animation: 'none', flex: 'none', ...(st === 'now' ? { width: 24, height: 24 } : { width: 22, height: 22 }) }}>
            <StateIcon state={st} />
          </i>
          {label}
        </li>
      ))}
      <li className="flex items-center gap-2.5">
        <i className="ln-gap" style={{ position: 'static', margin: 0, width: 34, flex: 'none' }} />
        Hueco libre
      </li>
      <li className="flex items-center gap-2.5">
        <i className="ln-off" style={{ position: 'static', margin: 0, width: 30, height: 14, flex: 'none' }} />
        No disponible
      </li>
    </ul>
  )
}

/**
 * El día como plano del Metro.
 *   mode="panel"  → lectura rápida: hora y nombre de pila; todo lleva a la Agenda.
 *   mode="agenda" → detalle completo; las estaciones abren la cita y los huecos agendan.
 */
export function LinesDiagram({
  day,
  mode,
  onSelect,
  onGap,
}: {
  day: DayModel
  mode: 'panel' | 'agenda'
  onSelect?: (appt: AppointmentView) => void
  onGap?: (resourceId: string | null) => void
}) {
  const { axis, lines, nowMin } = day
  const span = axis.end - axis.start
  const pct = (min: number) => `${((Math.min(Math.max(min, axis.start), axis.end) - axis.start) / span) * 100}%`
  const width = (a: number, b: number) => `${((Math.min(b, axis.end) - Math.max(a, axis.start)) / span) * 100}%`
  const hours: number[] = []
  for (let h = axis.start / 60; h <= axis.end / 60; h++) hours.push(h)
  const agendaHref = `/dashboard/agenda?date=${day.date}`
  const total = lines.reduce((n, l) => n + l.stations.length, 0)

  const renderStation = (s: Station, i: number) => {
    const pos = i % 2 === 0 ? 'up' : 'down'
    const label = `${hhmm(s.start)} ${s.client}, ${s.service}. ${STATE_LABEL[s.state]}`
    const inner = (
      <>
        <span className="ln-seg" />
        <i className="ln-dot"><StateIcon state={s.state} /></i>
        <span className="ln-lab" data-pos={pos}>
          {mode === 'agenda' ? (
            <>
              <b>{hhmm(s.start)}–{hhmm(s.end)}</b>{' '}
              {(s.state === 'wait' || s.state === 'now' || s.state === 'noshow') && (
                <span className="ln-chip" data-st={s.state}>{STATE_LABEL[s.state]}</span>
              )}
              <br />
              <b style={{ fontWeight: 600 }}>{s.client}</b> <em>{s.service}</em>
            </>
          ) : (
            <>
              <b>{hhmm(s.start)}</b> {s.client.split(' ')[0]}
            </>
          )}
        </span>
      </>
    )
    const style: CSSProperties = { left: pct(s.start), width: width(s.start, s.end) }
    return onSelect ? (
      <button key={s.id} type="button" className="ln-st" data-st={s.state} style={style} aria-label={label} onClick={() => onSelect(s.appt)} data-testid="appointment-block">
        {inner}
      </button>
    ) : (
      <Link key={s.id} href={agendaHref} className="ln-st" data-st={s.state} style={style} aria-label={label}>
        {inner}
      </Link>
    )
  }

  const renderGap = (line: Line, start: number, end: number) => {
    const wide = mode === 'agenda' && end - start >= 60
    const addLabel = `Agendar con ${line.name} entre ${hhmm(start)} y ${hhmm(end)}`
    // En un hueco de media hora el botón taparía las estaciones vecinas: se
    // deja solo el punteado (se sigue pudiendo agendar con «Nueva cita»).
    const roomy = end - start >= 45
    return (
      <span key={start} className="ln-gap" style={{ left: pct(start), width: width(start, end) }}>
        {!roomy ? null : onGap ? (
          <button type="button" className="ln-add" data-wide={wide || undefined} aria-label={addLabel} onClick={() => onGap(line.id)}>
            +{wide && ' Agendar'}
          </button>
        ) : (
          <Link href={`${agendaHref}&new=1${line.id ? `&resource=${line.id}` : ''}`} className="ln-add" aria-label={addLabel}>
            +
          </Link>
        )}
      </span>
    )
  }

  // ---- lista vertical para celular -----------------------------------
  type Row = { key: string; at: number; line: Line; station?: Station; gap?: { start: number; end: number } }
  const blocks: { line: Line | null; rows: Row[] }[] =
    mode === 'agenda'
      ? lines.map((line) => ({
          line,
          rows: [
            ...line.stations.map((s) => ({ key: s.id, at: s.start, line, station: s })),
            ...line.gaps.map((g) => ({ key: `g${g.start}`, at: g.start, line, gap: g })),
          ].sort((a, b) => a.at - b.at),
        }))
      : [
          {
            line: null,
            rows: lines
              .flatMap((line) => line.stations.map((s) => ({ key: s.id, at: s.start, line, station: s })))
              .sort((a, b) => a.at - b.at),
          },
        ]

  return (
    <div className="ln" style={{ '--ln-label': '112px', '--ln-row': mode === 'agenda' ? '158px' : '90px' } as Vars}>
      {/* ---------- ≥ md: diagrama horizontal ---------- */}
      <div className="hidden md:block">
        <div className="ln-hours pr-6">
          <div className="relative h-full">
            {hours.map((h) => (
              <span key={h} style={{ left: pct(h * 60) }}>{h}:00</span>
            ))}
          </div>
        </div>
        <div className="ln-body mb-8">
          <div className="ln-grid pr-6">
            <div className="relative h-full">
              {hours.map((h) => (
                <i key={h} style={{ left: pct(h * 60) }} />
              ))}
              {nowMin !== null && nowMin >= axis.start && nowMin <= axis.end && (
                <span className="ln-now" style={{ left: pct(nowMin) }}>
                  <b>{hhmm(nowMin)} ahora</b>
                </span>
              )}
            </div>
          </div>
          {lines.map((line) => (
            <div key={line.id ?? 'none'} className="ln-row" style={{ '--c': line.color } as Vars}>
              <div className="ln-label">
                <span className="ln-badge">{line.n}</span>
                <span title={line.name}>
                  <b>{line.name.split(' ')[0]}</b>
                  <small>{line.stations.length} {line.stations.length === 1 ? 'cita' : 'citas'}</small>
                </span>
              </div>
              <div className="ln-track pr-6">
                <div className="relative h-full">
                  {line.window ? (
                    <>
                      {line.window.start > axis.start && (
                        <span className="ln-off" style={{ left: 0, width: width(axis.start, line.window.start) }}>
                          {line.window.start - axis.start >= 60 && `Entra ${hhmm(line.window.start)}`}
                        </span>
                      )}
                      <span className="ln-base" style={{ left: pct(line.window.start), width: width(line.window.start, line.window.end) }} />
                      {line.window.end < axis.end && (
                        <span className="ln-off" style={{ left: pct(line.window.end), width: width(line.window.end, axis.end) }}>
                          {axis.end - line.window.end >= 60 && `Sale ${hhmm(line.window.end)}`}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="ln-base" style={{ left: 0, width: '100%', opacity: 0.35 }} />
                  )}
                  {line.gaps.map((g) => renderGap(line, g.start, g.end))}
                  {line.stations.map(renderStation)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- < md: lista vertical ---------- */}
      <div className="md:hidden">
        {total === 0 && mode === 'panel' && (
          <p className="py-3 text-[15px] text-ink-muted">Hoy no hay citas en la agenda.</p>
        )}
        {blocks.map(({ line, rows }) => {
          let nowShown = false
          return (
            <section key={line?.id ?? 'all'} className="mb-4 last:mb-0" style={line ? ({ '--c': line.color } as Vars) : undefined}>
              {line && (
                <h3 className="mb-2 flex items-center gap-2.5 text-[15px] font-semibold text-ink">
                  <span className="ln-badge">{line.n}</span>
                  {line.name}
                  <small className="font-normal text-ink-muted">
                    {line.stations.length} {line.stations.length === 1 ? 'cita' : 'citas'}
                  </small>
                </h3>
              )}
              <ol className="lm">
                {rows.map((row) => {
                  const marker = nowMin !== null && !nowShown && row.at > nowMin
                  if (marker) nowShown = true
                  const style = { '--c': row.line.color } as Vars
                  return (
                    <li key={row.key}>
                      {marker && <p className="lm-now"><b>{hhmm(nowMin ?? 0)}</b> ahora</p>}
                      {row.station ? (
                        <MobileStation row={row.station} line={row.line} style={style} showLine={mode === 'panel'} onSelect={onSelect} href={agendaHref} />
                      ) : row.gap ? (
                        <div className="lm-row" data-gap style={style}>
                          <span className="lm-rail" />
                          <div className="lm-body" style={{ cursor: 'default' }}>
                            <span>
                              <span className="t">{hhmm(row.gap.start)}–{hhmm(row.gap.end)}</span>
                              <em>libre</em>
                            </span>
                            {onGap && (
                              <button type="button" onClick={() => onGap(row.line.id)} className="ln-add mt-1.5" data-wide style={{ position: 'static', transform: 'none' }}>
                                + Agendar
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
              {line && rows.length === 0 && <p className="pb-2 text-sm text-ink-muted">Sin citas este día.</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function MobileStation({
  row,
  line,
  style,
  showLine,
  onSelect,
  href,
}: {
  row: Station
  line: Line
  style: CSSProperties
  showLine: boolean
  onSelect?: (appt: AppointmentView) => void
  href: string
}) {
  const body = (
    <>
      <span>
        <span className="t">{hhmm(row.start)}–{hhmm(row.end)}</span>
        <span className="ln-chip" data-st={row.state}>{STATE_LABEL[row.state]}</span>
      </span>
      <span>
        <b style={{ fontWeight: 600 }}>{row.client}</b> <em>· {row.service}{showLine ? ` con ${line.name}` : ''}</em>
      </span>
    </>
  )
  return (
    <div className="lm-row" style={style}>
      <span className="lm-rail" data-st={row.state}>
        <i className="ln-dot" data-st={row.state}><StateIcon state={row.state} /></i>
      </span>
      {onSelect ? (
        <button type="button" className="lm-body" onClick={() => onSelect(row.appt)} data-testid="appointment-row">
          {body}
        </button>
      ) : (
        <Link href={href} className="lm-body">{body}</Link>
      )}
    </div>
  )
}
