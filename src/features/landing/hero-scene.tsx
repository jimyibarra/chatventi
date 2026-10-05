'use client'

import { useEffect, useRef } from 'react'

// Héroe vivo de la home: tres negocios se turnan. La IA escribe, el cliente
// elige y la cita CAE como estación en la línea de su profesional, mientras se
// ilumina el canal por el que llegó (chips de «Contesta por»). Se pausa fuera
// de vista o con la pestaña oculta; con «reducir movimiento» se queda quieto el
// primer ejemplo, completo.

type Line = [kind: 'c' | 'a' | 'ok', html: string, time: string]
type Scenario = {
  biz: string
  av: string
  color: string
  ch: string
  chLabel: string
  day: string
  /** Línea del profesional en el plano (y del SVG). */
  y: number
  hour: number
  tag: string
  msgs: [Line, Line, Line, Line]
}

const CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'

const SCENARIOS: Scenario[] = [
  {
    biz: 'Barbería Capital', av: 'B', color: '#e0007a', ch: 'whatsapp', chLabel: 'WhatsApp', day: 'Mañana, domingo', y: 50, hour: 16, tag: 'Nueva · 4:00 pm',
    msgs: [
      ['c', 'Hola, ¿tienen lugar mañana para corte?', '23:47'],
      ['a', 'Claro. Mañana tengo <b>11:00</b>, <b>1:30</b> y <b>4:00 pm</b> con Marcela. ¿Cuál te acomoda?', '23:47'],
      ['c', 'A las 4', '23:48'],
      ['ok', 'Listo, te agendé mañana a las <b>4:00 pm</b> con Marcela. Te mando recordatorio.', '23:48'],
    ],
  },
  {
    biz: 'Clínica Dental Sonríe', av: 'D', color: '#0b5bd3', ch: 'instagram', chLabel: 'Instagram', day: 'Martes', y: 98, hour: 12.5, tag: 'Nueva · 12:30',
    msgs: [
      ['c', 'Buenos días, ¿tienen cita para limpieza el martes?', '07:10'],
      ['a', 'Sí. El martes tengo <b>10:00</b> y <b>12:30</b> con la Dra. Laura. La limpieza dura 45 minutos.', '07:10'],
      ['c', '12:30, por favor', '07:12'],
      ['ok', 'Listo: martes a las <b>12:30</b> con la Dra. Laura. Te escribo un día antes para confirmar.', '07:12'],
    ],
  },
  {
    biz: 'Veterinaria Huellitas', av: 'V', color: '#00a35c', ch: 'messenger', chLabel: 'Messenger', day: 'Sábado', y: 146, hour: 13, tag: 'Nueva · 1:00 pm',
    msgs: [
      ['c', '¿Pueden vacunar a mi perrita el sábado?', '21:15'],
      ['a', 'Claro. El sábado tengo <b>11:00</b> y <b>1:00 pm</b> con el Dr. Sergio. ¿Cuál prefieres?', '21:15'],
      ['c', 'A la 1', '21:16'],
      ['ok', 'Listo, sábado a la <b>1:00 pm</b> con el Dr. Sergio. También te recuerdo la próxima dosis.', '21:16'],
    ],
  },
]

function bubbleHtml([kind, html, time]: Line): string {
  const stamp = `<time class="num">${time}</time>`
  return kind === 'ok'
    ? `<p class="m a ok">${CHECK}<span>${html}${stamp}</span></p>`
    : `<p class="m ${kind}">${html}${stamp}</p>`
}

const FIRST_CHAT = SCENARIOS[0].msgs.map(bubbleHtml).join('')
/** Hora → x del plano (10:00 en x=74, 44 px por hora). */
const hourX = (hour: number) => 74 + (hour - 10) * 44
const EASE = 'cubic-bezier(.16,1,.3,1)'

type Els = Record<'msgs' | 'head' | 'node' | 'drop' | 'tag' | 'tagText' | 'av' | 'biz' | 'ch' | 'day' | 'sub', HTMLElement>

function pick(root: HTMLElement): Els {
  const q = (id: string) => root.querySelector(`#hv-${id}`) as HTMLElement
  return {
    msgs: q('msgs'), head: q('head'), node: q('new'), drop: q('drop'), tag: q('tag'), tagText: q('tag-t'),
    av: q('av'), biz: q('biz'), ch: q('ch'), day: q('day'), sub: q('sub'),
  }
}

class HeroRelay {
  private timers: ReturnType<typeof setTimeout>[] = []
  private idx = 0
  private running = false
  private visible = false
  private readonly el: Els

  constructor(private readonly root: HTMLElement) {
    this.el = pick(root)
  }

  stop = () => {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.running = false
  }

  setVisible(visible: boolean) {
    this.visible = visible
    if (visible && !this.running) this.later(() => this.play(), 600)
    if (!visible) this.stop()
  }

  onVisibility = () => {
    if (document.hidden) this.stop()
    else if (this.visible && !this.running) this.play()
  }

  /** El primer ejemplo ya está escrito: se queda unos segundos y empieza el turno. */
  start() {
    this.intro()
    this.idx = 1
    this.running = true
    this.later(() => {
      this.running = false
      if (this.visible && !document.hidden) this.play()
    }, 5200)
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms))
  }

  private play() {
    const sc = SCENARIOS[this.idx]
    this.stop()
    this.running = true
    const { msgs, node } = this.el
    msgs.classList.add('live')
    Array.from(msgs.children).forEach((m) => m.classList.add('out'))
    node.style.opacity = '0'
    this.later(() => {
      msgs.innerHTML = ''
      this.header(sc)
      this.place(sc)
    }, 230)
    this.converse(sc, 500)
    this.later(() => {
      this.idx = (this.idx + 1) % SCENARIOS.length
      if (this.visible && !document.hidden) this.play()
      else this.running = false
    }, 500 + 9200)
  }

  /** Cliente escribe → la IA «escribe…» → ofrece horarios → el cliente elige → confirma y la cita cae. */
  private converse(sc: Scenario, t: number) {
    const add = (line: Line) => this.el.msgs.insertAdjacentHTML('beforeend', bubbleHtml(line))
    let dots: HTMLElement | null = null
    this.later(() => add(sc.msgs[0]), t)
    this.later(() => (dots = this.typing()), t + 500)
    this.later(() => { dots?.remove(); add(sc.msgs[1]) }, t + 1500)
    this.later(() => add(sc.msgs[2]), t + 2700)
    this.later(() => (dots = this.typing()), t + 3150)
    this.later(() => { dots?.remove(); add(sc.msgs[3]) }, t + 3950)
    this.later(() => { this.el.node.style.opacity = '1'; this.land() }, t + 4150)
  }

  private typing(): HTMLElement {
    const p = document.createElement('p')
    p.className = 'm a typing'
    p.setAttribute('aria-label', 'La IA está escribiendo')
    p.innerHTML = '<i></i><i></i><i></i>'
    this.el.msgs.appendChild(p)
    return p
  }

  private header(sc: Scenario) {
    const { head, av, biz, ch, day, sub } = this.el
    head.classList.add('swap')
    this.later(() => {
      day.textContent = sc.day
      sub.textContent = `${sc.biz} · el día en líneas`
      head.classList.remove('swap')
    }, 260)
    av.textContent = sc.av
    av.style.backgroundColor = sc.color
    biz.textContent = sc.biz
    ch.textContent = `${sc.chLabel} · ejemplo`
    document.querySelectorAll('.lx .chip[data-ch]').forEach((c) => c.classList.toggle('now', c.getAttribute('data-ch') === sc.ch))
  }

  private place(sc: Scenario) {
    this.el.node.setAttribute('transform', `translate(${hourX(sc.hour)} ${sc.y})`)
    // La etiqueta va abajo de la estación, salvo en la última línea (arriba).
    this.el.tag.setAttribute('transform', sc.y > 120 ? 'translate(0 -36)' : 'translate(0 12)')
    this.el.tagText.textContent = sc.tag
  }

  /** La cita cae: entra desde arriba con desaceleración y la etiqueta aparece después. */
  private land() {
    this.el.drop.animate([{ transform: 'translateY(-34px) scale(.2)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 620, easing: EASE })
    this.el.tag.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 320, easing: 'ease-out', fill: 'backwards' })
  }

  /** Apertura: las líneas del día se trazan y las estaciones aparecen en orden. */
  private intro() {
    this.root.querySelectorAll<SVGLineElement>('#hv-lines line').forEach((l, i) => {
      l.style.strokeDasharray = '456'
      l.animate([{ strokeDashoffset: 456 }, { strokeDashoffset: 0 }], { duration: 700, delay: i * 120, easing: EASE, fill: 'backwards' })
    })
    this.root.querySelectorAll<SVGCircleElement>('#hv-stops circle').forEach((c, i) => {
      c.style.transformBox = 'fill-box'
      c.style.transformOrigin = 'center'
      c.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 380, delay: 420 + i * 60, easing: EASE, fill: 'backwards' })
    })
    this.land()
  }
}

/** Reserva el alto del chat para que la página no salte al cambiar de ejemplo. */
function lockHeight(msgs: HTMLElement) {
  const lock = () => (msgs.style.minHeight = `${msgs.offsetHeight + 18}px`)
  if (document.fonts?.ready) document.fonts.ready.then(lock)
  else lock()
}

export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    lockHeight(root.querySelector('#hv-msgs') as HTMLElement)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || !('IntersectionObserver' in window) || !Element.prototype.animate) {
      root.classList.add('on')
      return
    }
    const relay = new HeroRelay(root)
    const io = new IntersectionObserver(([e]) => {
      root.classList.toggle('on', e.isIntersecting)
      relay.setVisible(e.isIntersecting)
    }, { threshold: 0.2 })
    io.observe(root)
    document.addEventListener('visibilitychange', relay.onVisibility)
    relay.start()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', relay.onVisibility)
      relay.stop()
    }
  }, [])

  return (
    <div ref={ref} className="scene" aria-label="Ejemplo: un cliente escribe y la cita aparece en la agenda">
      <div className="chat">
        <div className="chat-head">
          <span className="av" id="hv-av">B</span>
          <span><b id="hv-biz">Barbería Capital</b><small id="hv-ch">WhatsApp · ejemplo</small></span>
          <span className="live"><i />Contesta la IA</span>
        </div>
        <div className="msgs" id="hv-msgs" aria-live="polite" dangerouslySetInnerHTML={{ __html: FIRST_CHAT }} />
      </div>
      <div className="plan">
        <div className="plan-head" id="hv-head"><b id="hv-day">Mañana, domingo</b><span id="hv-sub">Barbería Capital · el día en líneas</span></div>
        <PlanSvg />
      </div>
    </div>
  )
}

/** Plano del día: tres profesionales (líneas) y sus citas (estaciones). */
function PlanSvg() {
  return (
    <svg viewBox="0 0 520 176" role="img" aria-label="Agenda: la cita nueva aparece como estación en la línea de su profesional">
      <g fontSize="11" fill="#b9b2ea">
        {[10, 12, 14, 16, 18].map((h) => <text key={h} x={hourX(h) - 4} y="14">{h}</text>)}
        <text x="496" y="14">20</text>
      </g>
      <g stroke="#3d2f78" strokeWidth="1">
        {[10, 12, 14, 16, 18].map((h) => <line key={h} x1={hourX(h)} y1="22" x2={hourX(h)} y2="166" />)}
      </g>
      <g fontSize="12" fontWeight="700">
        {[['M', 50, '#e0007a'], ['L', 98, '#0b5bd3'], ['S', 146, '#00a35c']].map(([who, y, c]) => (
          <g key={who}>
            <circle cx="22" cy={y} r="15" fill={c as string} />
            <text x="22" y={(y as number) + 4.5} textAnchor="middle" fill="#fff">{who}</text>
          </g>
        ))}
      </g>
      <g id="hv-lines">
        <line x1="52" y1="50" x2="508" y2="50" stroke="#e0007a" strokeWidth="7" strokeLinecap="round" />
        <line x1="52" y1="98" x2="508" y2="98" stroke="#0b5bd3" strokeWidth="7" strokeLinecap="round" />
        <line x1="52" y1="146" x2="508" y2="146" stroke="#00a35c" strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* Estaciones: confirmadas (rellenas) y sin confirmar (aro amarillo). */}
      <g id="hv-stops">
        <circle cx="118" cy="50" r="9" fill="#e0007a" stroke="#fff" strokeWidth="3" />
        <circle cx="206" cy="50" r="9" fill="#e0007a" stroke="#fff" strokeWidth="3" />
        <circle cx="96" cy="98" r="9" fill="#0b5bd3" stroke="#fff" strokeWidth="3" />
        <circle cx="272" cy="98" r="9" fill="#fff" stroke="#ffcd2e" strokeWidth="4" />
        <circle cx="140" cy="146" r="9" fill="#00a35c" stroke="#fff" strokeWidth="3" />
        <circle cx="360" cy="146" r="9" fill="#00a35c" stroke="#fff" strokeWidth="3" />
        <circle cx="448" cy="146" r="9" fill="#fff" stroke="#ffcd2e" strokeWidth="4" />
      </g>
      {/* La cita nueva: se mueve a la línea y la hora de cada ejemplo. */}
      <g id="hv-new" transform="translate(338 50)">
        <circle className="pulse" r="12" fill="none" stroke="#ffcd2e" strokeWidth="3" />
        <g id="hv-drop"><circle r="12" fill="#ffcd2e" stroke="#fff" strokeWidth="3" /></g>
        <g id="hv-tag" transform="translate(0 12)">
          <rect x="-64" y="0" width="128" height="22" rx="11" fill="#ffcd2e" />
          <text id="hv-tag-t" x="0" y="15" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#2a1a5e">Nueva · 4:00 pm</text>
        </g>
      </g>
    </svg>
  )
}

/** Enciende `.on` en las secciones `[data-live]` mientras se ven: sus bucles (tren, parpadeos) se pausan fuera de vista. */
export function LiveSections() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.lx [data-live]')
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('on'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('on', e.isIntersecting)),
      { threshold: 0.2 },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return null
}
