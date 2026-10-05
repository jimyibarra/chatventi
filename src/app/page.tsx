import type { CSSProperties, ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'
import { pageMetadata } from '@/shared/lib/seo'
import { STARTER_PRICE_USD } from '@/features/billing/plans'
import { visitorCurrency } from '@/features/billing/currency'
import { FAQS, FARES, TRIAL_DAYS } from '@/features/landing/data'
import { foundersTaken } from '@/features/landing/founders'
import { AllIn, CTA, Checks, Close, Footer, Founders, Giros, TopBar, lxFont } from '@/features/landing/chrome'
import { HeroScene, LiveSections } from '@/features/landing/hero-scene'
import { Fares } from '@/features/landing/fares'
import { FaqList } from '@/features/landing/faq-list'
import { DemoChat } from '@/features/landing/demo-chat'
import { SalesWidget } from '@/features/landing/sales-widget'
import { Check } from '@/features/landing/check'
import '@/features/landing/lineas-landing.css'

// Home «Líneas»: la página es una línea del Metro. El mensaje del cliente se
// vuelve estación en la agenda (héroe vivo), el día se cuenta por horas y cada
// giro es una estación. Estilos en lineas-landing.css, todos bajo `.lx`;
// barra, pie, giros, fundadores y cierre se comparten con /para/* (chrome.tsx).

const HOME_TITLE = 'ChatVenti — Recepcionista IA que agenda citas por WhatsApp 24/7'
const HOME_DESC = `ChatVenti es la recepcionista con IA que agenda citas por WhatsApp, Instagram, Messenger y tu página de reservas. Contesta al instante, ofrece solo horarios libres y llena tu agenda 24/7. Prueba gratis ${TRIAL_DAYS} días.`

export const metadata: Metadata = pageMetadata({ title: HOME_TITLE, description: HOME_DESC, path: '/' })

// JSON-LD: producto (sin ratings inventados) + FAQ sincronizado con la página.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: LEGAL.brand,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: LEGAL.siteUrl,
  description:
    'Recepcionista con inteligencia artificial que agenda citas por WhatsApp, Instagram, Messenger y web 24/7 para barberías, dentistas, veterinarias, spas y consultorios.',
  offers: {
    '@type': 'Offer',
    price: String(STARTER_PRICE_USD),
    priceCurrency: 'USD',
    description: `Desde $${STARTER_PRICE_USD} USD/mes · ${TRIAL_DAYS} días de prueba gratis`,
  },
}
const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}

export default async function Home() {
  // Pesos para quien visita desde México; dólares para el resto (o lo que elija en el selector).
  const [currency, taken] = await Promise.all([visitorCurrency(), foundersTaken()])
  return (
    <div className={`${lxFont.variable} lx`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <TopBar />
      <main id="top">
        <Hero />
        <Channels />
        <Steps />
        <Day />
        <Panel />
        <Giros />
        <section className="s demo" id="demo" aria-labelledby="demo-t">
          <div className="wrap">
            <div>
              <div className="s-head">
                <h2 id="demo-t">Escríbele como si fueras tu cliente</h2>
                <p>Es el mismo motor que contestará en tu WhatsApp, conectado a la agenda de una estética de prueba. Pregunta un horario, un precio o pide tu cita.</p>
              </div>
              <Checks items={['Respuestas reales, no un video grabado', 'Consulta disponibilidad de verdad', 'Así se sentirá para tus clientes']} />
            </div>
            <DemoChat />
          </div>
        </section>
        <section className="s prices" id="precios" aria-labelledby="precios-t">
          <div className="wrap">
            <Fares fares={FARES} initial={currency} trialDays={TRIAL_DAYS} />
            <AllIn />
          </div>
        </section>
        <Founders taken={taken} />
        <section className="s" id="preguntas" aria-labelledby="faq-t" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="s-head"><h2 id="faq-t">Lo que todos preguntan antes de empezar</h2></div>
            <FaqList faqs={FAQS} />
          </div>
        </section>
        <Close />
      </main>
      <Footer />
      <LiveSections />
      {/* Asistente de ventas IA flotante: el producto vendiéndose a sí mismo, 24/7. */}
      <SalesWidget />
    </div>
  )
}

function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div>
          <p className="display">Tus clientes escriben. <span>ChatVenti agenda.</span></p>
          <h1>Recepcionista con IA que agenda citas por WhatsApp, Instagram y Messenger</h1>
          <p className="lede">Contesta al instante, ofrece solo tus horarios libres y deja la cita en tu agenda. A las 11 de la mañana o a las 11:47 de la noche.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/signup">{CTA}</Link>
            <a className="btn btn-ghost" href="#panel">Ver cómo se ve tu día</a>
          </div>
          <ul className="facts">
            {['Sin tarjeta de crédito', 'Lista en minutos', 'API oficial de Meta'].map((t) => <li key={t}><Check />{t}</li>)}
          </ul>
        </div>
        <HeroScene />
      </div>
    </section>
  )
}

const CHANNELS: { ch?: string; label: string; color: string; free?: boolean }[] = [
  { ch: 'whatsapp', label: 'WhatsApp', color: '#0b7d47' },
  { ch: 'instagram', label: 'Instagram', color: '#e0007a', free: true },
  { ch: 'messenger', label: 'Messenger', color: '#1468d6', free: true },
  { label: 'Telegram', color: '#2aa3e0' },
  { label: 'Tu página de reservas', color: '#5b4fe0' },
]

function Channels() {
  return (
    <section className="channels" aria-label="Canales">
      <div className="wrap">
        <p>Contesta por</p>
        <div className="chips">
          {CHANNELS.map((c) => (
            <span key={c.label} className={c.ch === 'whatsapp' ? 'chip now' : 'chip'} data-ch={c.ch} style={{ '--c': c.color } as CSSProperties}>
              <i />{c.label}{c.free && <em>sin costo por mensaje</em>}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Steps() {
  const steps = [
    ['Crea tu cuenta', 'Con tu correo. Eliges tu giro y la configuración rápida crea tus servicios, tu horario y tu recepcionista.', '2 minutos'],
    ['Conecta tus canales', 'WhatsApp con la ventana oficial de Meta. Instagram y Messenger con un botón.', 'Unos minutos'],
    ['Tu recepcionista contesta', 'Desde ese momento agenda, confirma y recuerda. Tú la ves trabajar en tu panel.', 'De día y de noche'],
  ]
  return (
    <section className="steps3" aria-labelledby="pasos-t">
      <div className="wrap">
        <div className="s-head"><h2 id="pasos-t">Empieza en 3 pasos</h2></div>
        <ol className="route3">
          {steps.map(([title, body, time], i) => (
            <li key={title}><span className="n">{i + 1}</span><h3>{title}</h3><p>{body}</p><small>{time}</small></li>
          ))}
        </ol>
        <div className="cta-row"><Link className="btn btn-primary" href="/signup">Empezar prueba gratis</Link></div>
      </div>
    </section>
  )
}

const DAY: [time: string, title: string, body: string][] = [
  ['07:10', '«¿Cuánto cuesta el tinte?»', 'Contesta con tus precios y servicios reales, antes de que abras.'],
  ['09:00', 'Sale el recordatorio', 'Un día antes y dos horas antes. El cliente confirma con un toque.'],
  ['13:30', 'Alguien no puede venir', 'Mueve su cita desde un enlace y el hueco queda libre para otro.'],
  ['16:00', 'Cita con anticipo', 'Pide el comprobante, aparta el horario y te avisa cuando llega.'],
  ['19:20', 'Un caso delicado', 'Te pasa el chat a ti cuando no debe decidir sola.'],
  ['23:47', 'Tú ya estás dormido', 'Agenda un corte para mañana en un horario libre.'],
]

function Day() {
  return (
    <section className="s day" id="dia" aria-labelledby="dia-t">
      <div className="wrap">
        <div className="s-head">
          <h2 id="dia-t">Un día cualquiera en tu negocio, con ChatVenti en el mostrador</h2>
          <p>Esto pasa entre que abres y cierras, y sigue pasando cuando ya te fuiste.</p>
        </div>
        <ol className="route">
          {DAY.map(([time, title, body], i) => (
            <li key={time} className={i === DAY.length - 1 ? 'stop night' : 'stop'}>
              <span className="t num">{time}</span><span className="dot" /><h3>{title}</h3><p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Panel() {
  return (
    <section className="s" id="panel" data-live aria-labelledby="panel-t">
      <div className="wrap">
        <div className="s-head">
          <h2 id="panel-t">Así se ve tu día: cada profesional es una línea y cada cita, una estación</h2>
          <p>Lo que la recepcionista agenda aparece aquí al instante. De un vistazo sabes quién está ocupado, dónde hay hueco y qué te toca hacer.</p>
        </div>
        <div className="board">
          <div className="panel-plan">
            <div className="ph"><b>Hoy, sábado</b><span className="num">13 citas · 2 sin confirmar</span></div>
            <div className="scroll-x"><DaySvg /></div>
            <Legend />
          </div>
          <div className="side">
            <div className="avisos">
              <h3>Avisos</h3>
              <ul>
                <li><span>Citas sin confirmar</span><b className="num">2</b></li>
                <li><span>Chat que te espera</span><b className="num">1</b></li>
                <li><span>Anticipo por revisar</span><b className="num">1</b></li>
              </ul>
            </div>
            <div className="ia">
              <h3>Recepcionista IA</h3>
              <p>Hoy respondió <b className="num">38 mensajes</b>, agendó <b className="num">6 citas</b> y te pasó <b>1 chat</b>.</p>
              <div className="money num">$18,450</div>
              <small>en servicios agendados por ella este mes</small>
            </div>
          </div>
        </div>
        <p className="sample">Datos de ejemplo. Es el mismo panel que recibes al registrarte.</p>
        <div className="callouts">
          <div><b>Arriba, lo que pasa ahora</b><p>Quién está atendiendo y quién sigue, por profesional.</p></div>
          <div><b>En amarillo, lo que te toca</b><p>Solo lo que espera algo de ti: confirmar, contestar, revisar un pago.</p></div>
          <div><b>Lo que hizo la IA, con hechos</b><p>Cuántos mensajes contestó y cuánto dinero agendó por ti.</p></div>
        </div>
      </div>
    </section>
  )
}

const PEOPLE: [name: string, y: number, color: string][] = [['Karla', 66, '#e0007a'], ['Luis', 126, '#0b5bd3'], ['Sofía', 186, '#00a35c'], ['Ana', 246, '#f08c00']]
const HOURS = ['9:00', '11:00', '13:00', '15:00', '17:00', '19:00']

/** Plano de muestra del Panel: cuatro profesionales de 9:00 a 20:00, con cada estado de estación. */
function DaySvg() {
  const done: [number, number, string][] = [[145, 66, '#e0007a'], [250, 126, '#0b5bd3'], [180, 186, '#00a35c'], [320, 246, '#f08c00'], [355, 66, '#e0007a']]
  const confirmed: [number, number, string][] = [[530, 66, '#e0007a'], [600, 186, '#00a35c'], [705, 246, '#f08c00'], [740, 126, '#0b5bd3']]
  return (
    <svg viewBox="0 0 900 300" role="img" aria-label="El día en líneas de cuatro profesionales, de 9:00 a 20:00">
      <g fontSize="12" fill="#584d84">{HOURS.map((h, i) => <text key={h} x={110 + i * 140} y="18" textAnchor="middle">{h}</text>)}</g>
      <g stroke="#e6e9f4" strokeWidth="1">{HOURS.map((h, i) => <line key={h} x1={110 + i * 140} y1="28" x2={110 + i * 140} y2="286" />)}</g>
      <g fontSize="13" fontWeight="700">
        {PEOPLE.map(([name, y, c], i) => (
          <g key={name}>
            <circle cx="30" cy={y} r="17" fill={c} />
            <text x="30" y={y + 4.5} textAnchor="middle" fill="#fff">{i + 1}</text>
            <text x="54" y={y + 4.5} fill="#2a1a5e">{name}</text>
          </g>
        ))}
      </g>
      {PEOPLE.map(([name, y, c]) => <line key={name} x1="100" y1={y} x2="880" y2={y} stroke={c} strokeWidth="8" strokeLinecap="round" />)}
      {/* Ahora: 13:40 */}
      <line x1="436.7" y1="28" x2="436.7" y2="286" stroke="#2a1a5e" strokeWidth="2" strokeDasharray="4 4" />
      <rect x="408" y="270" width="58" height="22" rx="11" fill="#2a1a5e" />
      <text x="437" y="285" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">Ahora</text>
      {/* Atendidas (palomita) */}
      {done.map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="11" fill="#fff" stroke={c} strokeWidth="4" />
          <path d={`m${x - 5} ${y} 3.5 3.5 6-7`} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {/* En curso */}
      <circle className="breath" cx="425" cy="126" r="12" fill="none" stroke="#2a1a5e" strokeWidth="3" />
      <circle cx="425" cy="126" r="12" fill="#2a1a5e" stroke="#fff" strokeWidth="3" />
      {/* Confirmadas */}
      <g stroke="#fff" strokeWidth="3">{confirmed.map(([x, y, c]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill={c} />)}</g>
      {/* Sin confirmar */}
      <g className="wait-blink" fill="#fff" stroke="#ffcd2e" strokeWidth="4"><circle cx="670" cy="66" r="11" /><circle cx="810" cy="186" r="11" /></g>
      {/* No llegó */}
      <circle cx="215" cy="246" r="11" fill="#fff" stroke="#a51b18" strokeWidth="4" />
      <path d="m210 241 10 10m0-10-10 10" stroke="#a51b18" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Legend() {
  const items: [string, ReactNode][] = [
    ['Atendida', <><circle cx="8" cy="8" r="6" fill="#fff" stroke="#2a1a5e" strokeWidth="2.5" /><path d="m5.3 8.2 1.8 1.8 3.6-3.9" fill="none" stroke="#2a1a5e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>],
    ['En curso', <circle key="s" cx="8" cy="8" r="7" fill="#2a1a5e" />],
    ['Confirmada', <circle key="s" cx="8" cy="8" r="7" fill="#0b5bd3" />],
    ['Sin confirmar', <circle key="s" cx="8" cy="8" r="6" fill="#fff" stroke="#ffcd2e" strokeWidth="2.5" />],
    ['No llegó', <><circle cx="8" cy="8" r="6" fill="#fff" stroke="#a51b18" strokeWidth="2.5" /><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="#a51b18" strokeWidth="1.8" strokeLinecap="round" /></>],
  ]
  return (
    <div className="legend">
      {items.map(([label, shape]) => (
        <span key={label}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">{shape}</svg>{label}</span>
      ))}
    </div>
  )
}

