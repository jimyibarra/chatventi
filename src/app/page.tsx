import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Inter, Manrope } from 'next/font/google'
import { LEGAL } from '@/shared/constants/legal'
import { STARTER_PRICE_USD } from '@/features/billing/plans'
import {
  FAQS,
  FEATURES,
  INDUSTRIES,
  PRICING,
  PROBLEMS,
  STEPS,
  TESTIMONIALS,
  TRIAL_DAYS,
} from '@/features/landing/data'
import { Icon, PhoneIcon, WhatsAppIcon } from '@/features/landing/icons'
import { LandingEffects } from '@/features/landing/effects'
import { DemoChat } from '@/features/landing/demo-chat'
import '@/features/landing/landing.css'

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-manrope' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ChatVenti — Recepcionista IA que agenda citas por WhatsApp 24/7',
  description: `ChatVenti es el recepcionista con IA para agendar citas por WhatsApp, Telegram y web. Contesta al instante, evita dobles reservas y llena tu agenda 24/7. Prueba gratis ${TRIAL_DAYS} días.`,
}

// JSON-LD: producto (sin ratings inventados) + FAQ sincronizado con la página.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: LEGAL.brand,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: LEGAL.siteUrl,
  description:
    'Recepcionista con inteligencia artificial que agenda citas por WhatsApp, Telegram y web 24/7 para peluquerías, dentistas, clínicas, spas y consultorios.',
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
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const CHAT_MSGS = [
  { me: true, html: 'Hola! Tienen lugar para corte el sábado? 🙏' },
  { me: false, html: '¡Hola! 😊 Claro que sí. El sábado tengo disponible <strong>11:00 am</strong>, <strong>1:30 pm</strong> y <strong>4:00 pm</strong>. ¿Cuál te queda mejor?' },
  { me: true, html: 'A las 4 está perfecto' },
  { me: false, html: '¡Listo! ✅ Te agendé:<br /><strong>Corte de cabello</strong><br />Sábado 11 · 4:00 pm · con Marcela<br /><br />Te mando recordatorio un día antes. ¡Nos vemos!' },
]

const DEMO_ROWS = [
  { time: '10:00', who: 'Karla Mendoza — Corte y peinado', via: 'Agendada por IA · WhatsApp', chip: 'Confirmada', live: false },
  { time: '11:30', who: 'Luis Ortega — Tinte completo', via: 'Agendada por IA · Telegram', chip: 'Confirmada', live: false },
  { time: '13:00', who: 'Ana Ruiz — Manicure spa', via: '✨ Agendándose ahora mismo…', chip: '', live: true },
  { time: '16:00', who: 'Sofía Delgado — Corte de cabello', via: 'Reagendada desde el panel · antes 12:00', chip: 'Recordatorio enviado', live: false },
]

const H3: CSSProperties = { fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px' }
const BODY_MUTED: CSSProperties = { color: '#5F5A75', fontSize: 15.5, lineHeight: 1.6, margin: 0 }

export default function Home() {
  return (
    <div className={`${manrope.variable} ${inter.variable} cv-landing`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <LandingEffects />

      {/* ============ HEADER ============ */}
      <header className="cv-header">
        <div className="cv-container" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <a href="#inicio" aria-label="ChatVenti — inicio" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 21, color: '#201B36' }}>
            <span aria-hidden style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg, #6D4FE0, #4338CA)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 16, fontWeight: 800 }}>C</span>
            Chat<span style={{ color: '#5B4FE0' }}>Venti</span>
          </a>
          <nav aria-label="Navegación principal" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            <a className="cv-navlink" href="#como-funciona">Cómo funciona</a>
            <a className="cv-navlink" href="#funciones">Funciones</a>
            <a className="cv-navlink" href="#precios">Precios</a>
            <a className="cv-navlink" href="#faq">Preguntas</a>
            <Link className="cv-navlink" href="/login">Entrar</Link>
          </nav>
          <Link href="/signup" className="cv-btn-primary" style={{ padding: '11px 22px', fontSize: 15 }}>Prueba gratis</Link>
        </div>
      </header>

      <main>
        {/* ============ HERO ============ */}
        <section id="inicio" aria-label="Presentación de ChatVenti" style={{ position: 'relative', background: 'linear-gradient(180deg, #F4F2FE 0%, #FBFAF6 78%)' }}>
          <div className="cv-container" style={{ padding: '72px 24px 56px', display: 'flex', gap: 56, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 460px', minWidth: 320 }}>
              <p style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 0 22px', background: '#E9F9EF', color: '#128C4A', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 999 }}>
                <span aria-hidden className="cv-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} />
                Respondiendo WhatsApps ahora mismo, 24/7
              </p>
              <h1 className="cv-h1" style={{ fontSize: 'clamp(38px, 5.2vw, 58px)', lineHeight: 1.08, margin: '0 0 20px' }}>
                Tu recepcionista con IA que{' '}
                <span style={{ background: 'linear-gradient(100deg, #5B4FE0, #7C4FE0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  agenda citas por WhatsApp
                </span>
                , incluso mientras duermes
              </h1>
              <p style={{ fontSize: 'clamp(17px, 2vw, 20px)', lineHeight: 1.6, color: '#5F5A75', margin: '0 0 30px', maxWidth: 540 }}>
                ChatVenti contesta al instante, agenda, confirma y recuerda cada cita por WhatsApp, Telegram y tu web — sin llamadas perdidas ni dobles reservas.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <Link href="/signup" className="cv-btn-primary" style={{ padding: '16px 34px', fontSize: 17 }}>Empezar prueba gratis</Link>
                <a href="#demo" className="cv-btn-ghost" style={{ padding: '15px 24px', fontSize: 16 }}>
                  <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5-9-5.5z" /></svg>
                  Ver el producto
                </a>
              </div>
              <p style={{ fontSize: 14, color: '#7A758F', margin: '0 0 28px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>✓ {TRIAL_DAYS} días de prueba gratis</span><span>✓ Sin contratos forzosos</span><span>✓ Listo en minutos</span>
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#5F5A75', maxWidth: 480 }}>
                Hecho para <strong style={{ color: '#201B36' }}>peluquerías, barberías, dentistas, spas y consultorios</strong> — cualquier negocio que vive de su agenda.
              </p>
            </div>

            {/* Mockup de conversación WhatsApp */}
            <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', justifyContent: 'center' }} role="img" aria-label="Simulación de una conversación de WhatsApp donde la IA de ChatVenti agenda una cita de corte de cabello para el sábado a las 4 de la tarde">
              <div className="cv-float" style={{ width: '100%', maxWidth: 390, background: '#fff', borderRadius: 32, boxShadow: '0 30px 70px rgba(62,51,181,0.18), 0 4px 16px rgba(32,27,54,0.06)', overflow: 'hidden', border: '1px solid #ECE9F5' }}>
                <div style={{ background: 'linear-gradient(120deg, #1DA851, #25D366)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-manrope), sans-serif' }}>E</span>
                  <div>
                    <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 15 }}>Estética Marcela</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 12.5 }}>en línea · responde al instante</p>
                  </div>
                  <PhoneIcon />
                </div>
                <div style={{ background: '#F1EFE8', padding: '20px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 380 }}>
                  {CHAT_MSGS.map((m, i) => (
                    <div
                      key={i}
                      data-chat-msg
                      style={{
                        alignSelf: m.me ? 'flex-end' : 'flex-start',
                        maxWidth: m.me ? '78%' : '82%',
                        background: m.me ? '#DCF8C6' : '#fff',
                        padding: '10px 14px',
                        borderRadius: m.me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        fontSize: 14.5,
                        lineHeight: 1.45,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }}
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                  ))}
                  <div data-chat-msg style={{ alignSelf: 'center', background: 'rgba(91,79,224,0.1)', color: '#4A3FC4', fontSize: 12.5, fontWeight: 600, padding: '7px 16px', borderRadius: 999, marginTop: 6 }}>
                    ✨ Cita agendada por ChatVenti en 22 segundos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ BARRA DE CONFIANZA ============ */}
        <section aria-label="Tipos de negocio para los que está hecho ChatVenti" style={{ borderTop: '1px solid #ECE9F5', borderBottom: '1px solid #ECE9F5', background: '#fff' }}>
          <div className="cv-container" style={{ padding: '26px 24px', display: 'flex', alignItems: 'center', gap: '12px 34px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B96B0' }}>Hecho para negocios de citas</p>
            {['✂ Peluquerías', '🦷 Dentistas', '💆 Spas', '💈 Barberías', '✨ Clínicas estéticas', '🩺 Consultorios'].map((t) => (
              <span key={t} style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 17, color: '#6A6580' }}>{t}</span>
            ))}
          </div>
        </section>

        {/* ============ EL PROBLEMA ============ */}
        <section aria-labelledby="problema-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head">
            <p className="cv-eyebrow">El problema</p>
            <h2 id="problema-titulo" className="cv-h2">Cada mensaje sin contestar es una cita que pierdes</h2>
            <p className="cv-lead">Tus clientes escriben cuando pueden: en la noche, el domingo, a media comida. Si no respondes en minutos, reservan con alguien más.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {PROBLEMS.map((p) => (
              <article key={p.title} data-reveal className="cv-card">
                <span aria-hidden style={{ width: 52, height: 52, borderRadius: 16, background: p.tint, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
                  <Icon name={p.icon} stroke={p.icon === 'phone-x' ? '#D64545' : p.icon === 'calendar-x' ? '#D48A1E' : '#5B4FE0'} size={26} />
                </span>
                <h3 style={H3}>{p.title}</h3>
                <p style={BODY_MUTED}>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============ CÓMO FUNCIONA ============ */}
        <section id="como-funciona" aria-labelledby="como-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head">
            <p className="cv-eyebrow">Cómo funciona</p>
            <h2 id="como-titulo" className="cv-h2">Listo para agendar en 3 pasos</h2>
            <p className="cv-lead">Sin instalar nada, sin saber de tecnología. Si sabes usar WhatsApp, sabes usar ChatVenti.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} data-reveal className="cv-step-card">
                <span style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 15, color: '#fff', background: 'linear-gradient(120deg, #5B4FE0, #4338CA)', width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', marginBottom: 20 }}>{i + 1}</span>
                <h3 style={H3}>{s.title}</h3>
                <p style={{ ...BODY_MUTED, marginBottom: 18 }}>{s.body}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: s.badgeStyle === 'green' ? '#128C4A' : '#4A3FC4', background: s.badgeStyle === 'green' ? '#E9F9EF' : '#EFEDFB', padding: '6px 14px', borderRadius: 999 }}>{s.badge}</span>
              </div>
            ))}
          </div>
          <div data-reveal style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href="/signup" className="cv-btn-primary" style={{ padding: '15px 32px', fontSize: 16 }}>Empezar prueba gratis — listo en minutos</Link>
          </div>
        </section>

        {/* ============ FUNCIONES ============ */}
        <section id="funciones" aria-labelledby="funciones-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head" style={{ maxWidth: 680 }}>
            <p className="cv-eyebrow">Todo lo que hace por ti</p>
            <h2 id="funciones-titulo" className="cv-h2">Un empleado que nunca pide vacaciones</h2>
            <p className="cv-lead">ChatVenti no solo responde: agenda, confirma, recuerda, da seguimiento y te mantiene al mando desde un solo panel.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {FEATURES.map((f) => (
              <article key={f.title} data-reveal className="cv-card-hover">
                <span aria-hidden className="cv-icon-tile" style={{ background: f.tint }}>
                  <Icon name={f.icon} stroke={f.stroke} />
                </span>
                <h3 style={{ ...H3, fontSize: 18, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ ...BODY_MUTED, fontSize: 15 }}>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============ DEMO / PRODUCTO ============ */}
        <section id="demo" aria-labelledby="demo-titulo" style={{ background: 'linear-gradient(160deg, #241D52 0%, #3E33B5 60%, #5B4FE0 100%)', marginTop: 88 }}>
          <div className="cv-container" style={{ padding: '88px 24px', display: 'flex', gap: 56, alignItems: 'center', flexWrap: 'wrap' }}>
            <div data-reveal style={{ flex: '1 1 400px', minWidth: 300 }}>
              <p className="cv-eyebrow" style={{ color: '#B7E8CB' }}>El producto en acción</p>
              <h2 id="demo-titulo" className="cv-h2" style={{ color: '#fff', marginBottom: 18 }}>Tu agenda se llena sola. Tú solo la miras.</h2>
              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 1.65, margin: '0 0 28px', maxWidth: 480 }}>
                Mientras la IA conversa y agenda, tu panel te muestra el día en orden: quién viene, a qué hora y qué servicio. Todo sincronizado, sin libreta y sin memorizar nada.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'grid', gap: 12, color: 'rgba(255,255,255,0.92)', fontSize: 15.5 }}>
                {['Cada cita agendada por la IA aparece al instante', 'Toma el control de cualquier conversación — la IA se pausa sola', 'Funciona desde tu celular o computadora'].map((t) => (
                  <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}><span style={{ color: '#25D366', fontWeight: 800 }}>✓</span> {t}</li>
                ))}
              </ul>
              <Link href="/signup" className="cv-btn-green" style={{ padding: '15px 32px', fontSize: 16 }}>Probarlo gratis ahora</Link>
            </div>
            <div data-reveal style={{ flex: '1 1 420px', minWidth: 300 }} role="img" aria-label="Panel de control de ChatVenti mostrando las citas del día agendadas automáticamente por la inteligencia artificial">
              <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 30px 70px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECE9F5', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 16 }}>Hoy, en tu agenda</p>
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#128C4A', background: '#E9F9EF', padding: '5px 12px', borderRadius: 999 }}>8 citas · $3,450</span>
                </div>
                <div style={{ padding: '14px 22px', display: 'grid', gap: 10 }}>
                  {DEMO_ROWS.map((r) => (
                    <div key={r.time} style={{ display: 'flex', gap: 14, alignItems: 'center', background: r.live ? '#F4F2FE' : '#FBFAF6', border: r.live ? '1.5px solid #C7BFF5' : '1px solid #ECE9F5', borderRadius: 14, padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#5B4FE0', minWidth: 62 }}>{r.time}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5 }}>{r.who}</p>
                        <p style={{ margin: 0, fontSize: 12.5, color: r.live ? '#5B4FE0' : '#7A758F', fontWeight: r.live ? 600 : 400 }}>{r.via}</p>
                      </div>
                      {r.live ? (
                        <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden>
                          <span className="cv-typing-dot" />
                          <span className="cv-typing-dot" style={{ animationDelay: '0.2s' }} />
                          <span className="cv-typing-dot" style={{ animationDelay: '0.4s' }} />
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: r.chip === 'Confirmada' ? '#128C4A' : '#D48A1E', background: r.chip === 'Confirmada' ? '#E9F9EF' : '#FFF4E3', padding: '4px 10px', borderRadius: 999 }}>{r.chip}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #ECE9F5', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#7A758F' }}><strong style={{ color: '#201B36', fontSize: 16 }}>42</strong> conversaciones hoy</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#7A758F' }}><strong style={{ color: '#201B36', fontSize: 16 }}>96%</strong> respondidas por IA</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#7A758F' }}><strong style={{ color: '#201B36', fontSize: 16 }}>18 seg</strong> respuesta promedio</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ DEMO EN VIVO ============ */}
        <section id="demo-en-vivo" aria-labelledby="demo-vivo-titulo" className="cv-container cv-section">
          <div style={{ display: 'flex', gap: 56, alignItems: 'center', flexWrap: 'wrap' }}>
            <div data-reveal style={{ flex: '1 1 400px', minWidth: 300 }}>
              <p className="cv-eyebrow">Pruébalo tú mismo, ahora</p>
              <h2 id="demo-vivo-titulo" className="cv-h2" style={{ marginBottom: 18 }}>
                Habla con la IA como si fueras tu cliente
              </h2>
              <p style={{ ...BODY_MUTED, fontSize: 17, maxWidth: 480, marginBottom: 24 }}>
                Esto no es un video ni capturas: es el mismo motor que atenderá a tus clientes,
                conectado a la agenda de una estética de demostración. Pregúntale precios,
                pide un horario y mira cómo agenda la cita en segundos.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, color: '#201B36', fontSize: 15.5 }}>
                {['Respuestas reales generadas por IA, sin guion', 'Consulta disponibilidad y agenda de verdad', 'Así se sentirá para tus clientes en WhatsApp'].map((t) => (
                  <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ color: '#5B4FE0', fontWeight: 800 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal style={{ flex: '1 1 420px', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
              <DemoChat />
            </div>
          </div>
        </section>

        {/* ============ INDUSTRIAS ============ */}
        <section id="industrias" aria-labelledby="industrias-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head">
            <p className="cv-eyebrow">Hecho para tu negocio</p>
            <h2 id="industrias-titulo" className="cv-h2">Si vives de las citas, ChatVenti es para ti</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            {INDUSTRIES.map((ind) => (
              <article key={ind.title} data-reveal className="cv-card-hover" style={{ padding: '30px 26px' }}>
                <span aria-hidden style={{ fontSize: 30 }}>{ind.emoji}</span>
                <h3 style={{ ...H3, fontSize: 19, margin: '14px 0 8px' }}>{ind.title}</h3>
                <p style={{ ...BODY_MUTED, fontSize: 14.5, marginBottom: 16 }}>{ind.body}</p>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#128C4A' }}>{ind.stat}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============ TESTIMONIOS ============ */}
        <section aria-labelledby="testimonios-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head">
            <p className="cv-eyebrow">Resultados reales</p>
            <h2 id="testimonios-titulo" className="cv-h2" style={{ margin: 0 }}>Negocios como el tuyo, agendas llenas</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24 }}>
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} data-reveal className="cv-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <p aria-hidden style={{ margin: 0, color: '#F2B01E', fontSize: 16, letterSpacing: 2 }}>★★★★★</p>
                <blockquote style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#37324D' }}>{t.quote}</blockquote>
                <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                  <span aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', background: t.bg, display: 'grid', placeItems: 'center', fontWeight: 800, color: t.fg, fontFamily: 'var(--font-manrope), sans-serif' }}>{t.initials}</span>
                  <span><strong style={{ display: 'block', fontSize: 14.5 }}>{t.name}</strong><span style={{ fontSize: 13, color: '#7A758F' }}>{t.role}</span></span>
                  <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 800, color: '#128C4A', background: '#E9F9EF', padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{t.chip}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ============ PRECIOS (catálogo real de billing) ============ */}
        <section id="precios" aria-labelledby="precios-titulo" className="cv-container cv-section">
          <div data-reveal className="cv-section-head">
            <p className="cv-eyebrow">Precios</p>
            <h2 id="precios-titulo" className="cv-h2">Un plan base, y la IA cuando la necesites</h2>
            <p className="cv-lead">Empieza con {TRIAL_DAYS} días de prueba gratis. Elige cuánto volumen de conversaciones atiende la IA — y cámbialo cuando quieras. Precios en USD.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'stretch' }}>
            <article data-reveal style={{ background: '#fff', border: '1px solid #ECE9F5', borderRadius: 26, padding: '36px 30px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>{PRICING.starter.name}</h3>
              <p style={{ color: '#7A758F', fontSize: 14.5, margin: '0 0 22px' }}>{PRICING.starter.desc}</p>
              <p style={{ margin: '0 0 24px' }}><span style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 46 }}>${PRICING.starter.price}</span><span style={{ color: '#7A758F', fontSize: 15 }}> USD/mes</span></p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 11, fontSize: 15, color: '#37324D' }}>
                {PRICING.starter.items.map((it) => (
                  <li key={it} style={{ display: 'flex', gap: 10 }}><span style={{ color: '#5B4FE0', fontWeight: 800 }}>✓</span> {it}</li>
                ))}
              </ul>
              <Link href="/signup" className="cv-btn-ghost" style={{ marginTop: 'auto', justifyContent: 'center', padding: '14px 24px', fontSize: 15.5, fontWeight: 700 }}>{PRICING.starter.cta}</Link>
            </article>

            <article data-reveal style={{ position: 'relative', background: 'linear-gradient(165deg, #2C2465, #4338CA)', borderRadius: 26, padding: '36px 30px', display: 'flex', flexDirection: 'column', color: '#fff', boxShadow: '0 24px 56px rgba(62,51,181,0.35)', transform: 'scale(1.02)' }}>
              <span style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#25D366', color: '#0B3D22', fontSize: 12.5, fontWeight: 800, padding: '7px 18px', borderRadius: 999, whiteSpace: 'nowrap' }}>{PRICING.popular.badge}</span>
              <h3 style={{ ...H3, margin: '6px 0' }}>{PRICING.popular.name}</h3>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14.5, margin: '0 0 22px' }}>{PRICING.popular.desc}</p>
              <p style={{ margin: '0 0 24px' }}><span style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 46 }}>${PRICING.popular.price}</span><span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }}> USD/mes</span></p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 11, fontSize: 15 }}>
                {PRICING.popular.items.map((it) => (
                  <li key={it} style={{ display: 'flex', gap: 10 }}><span style={{ color: '#25D366', fontWeight: 800 }}>✓</span> {it}</li>
                ))}
              </ul>
              <Link href="/signup" className="cv-btn-green" style={{ marginTop: 'auto', textAlign: 'center', padding: '15px 24px', fontSize: 16 }}>{PRICING.popular.cta}</Link>
              <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>{PRICING.popular.foot}</p>
            </article>

            <article data-reveal style={{ background: '#fff', border: '1px solid #ECE9F5', borderRadius: 26, padding: '36px 30px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ ...H3, marginBottom: 6 }}>{PRICING.volume.name}</h3>
              <p style={{ color: '#7A758F', fontSize: 14.5, margin: '0 0 22px' }}>{PRICING.volume.desc}</p>
              <p style={{ margin: '0 0 24px' }}><span style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 46 }}>${PRICING.volume.price}</span><span style={{ color: '#7A758F', fontSize: 15 }}> USD/mes</span></p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 11, fontSize: 15, color: '#37324D' }}>
                {PRICING.volume.items.map((it) => (
                  <li key={it} style={{ display: 'flex', gap: 10 }}><span style={{ color: '#5B4FE0', fontWeight: 800 }}>✓</span> {it}</li>
                ))}
              </ul>
              <Link href="/signup" className="cv-btn-ghost" style={{ marginTop: 'auto', justifyContent: 'center', padding: '14px 24px', fontSize: 15.5, fontWeight: 700 }}>{PRICING.volume.cta}</Link>
            </article>
          </div>
          <p data-reveal style={{ textAlign: 'center', margin: '28px auto 0', maxWidth: 760, fontSize: 14, color: '#7A758F', lineHeight: 1.65 }}>{PRICING.footnote}</p>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" aria-labelledby="faq-titulo" style={{ maxWidth: 820, margin: '0 auto', padding: '88px 24px 40px' }}>
          <div data-reveal style={{ textAlign: 'center', marginBottom: 44 }}>
            <p className="cv-eyebrow">Preguntas frecuentes</p>
            <h2 id="faq-titulo" className="cv-h2" style={{ margin: 0 }}>Lo que todos preguntan antes de empezar</h2>
          </div>
          <div data-reveal style={{ display: 'grid', gap: 12 }}>
            {FAQS.map((f) => (
              <details key={f.q} className="cv-faq">
                <summary>{f.q}<span aria-hidden className="cv-faq-plus">+</span></summary>
                <p className="cv-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ============ CTA FINAL ============ */}
        <section aria-labelledby="cta-titulo" className="cv-container" style={{ padding: '88px 24px' }}>
          <div data-reveal style={{ position: 'relative', background: 'linear-gradient(140deg, #241D52 0%, #4338CA 55%, #6D4FE0 100%)', borderRadius: 32, padding: 'clamp(48px, 7vw, 84px) clamp(28px, 6vw, 80px)', textAlign: 'center', overflow: 'hidden', boxShadow: '0 30px 70px rgba(62,51,181,0.3)' }}>
            <span aria-hidden style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(37,211,102,0.18)', filter: 'blur(10px)' }} />
            <span aria-hidden style={{ position: 'absolute', bottom: -100, left: -70, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(6px)' }} />
            <h2 id="cta-titulo" style={{ position: 'relative', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 'clamp(30px, 4.5vw, 48px)', lineHeight: 1.12, margin: '0 0 18px', color: '#fff', letterSpacing: '-0.02em' }}>
              Mientras lees esto, alguien le está escribiendo a tu competencia
            </h2>
            <p style={{ position: 'relative', color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.6, margin: '0 auto 34px', maxWidth: 560 }}>
              Activa tu recepcionista con IA hoy y no vuelvas a perder una cita por no contestar a tiempo.
            </p>
            <div style={{ position: 'relative', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/signup" className="cv-btn-green" style={{ padding: '17px 40px', fontSize: 17.5, boxShadow: '0 10px 28px rgba(0,0,0,0.3)' }}>Empezar prueba gratis</Link>
            </div>
            <p style={{ position: 'relative', margin: '18px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{TRIAL_DAYS} días gratis · Cancela cuando quieras · Listo en minutos</p>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="cv-footer" style={{ background: '#17123A', color: '#B9B4D6' }}>
        <div className="cv-container" style={{ padding: '64px 24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>
          <div>
            <p style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 0 14px' }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6D4FE0, #4338CA)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 15 }}>C</span>
              {LEGAL.brand}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: 260 }}>El recepcionista con IA que agenda citas por WhatsApp, Telegram y web, 24/7, para negocios de citas en Latinoamérica.</p>
          </div>
          <nav aria-label="Producto">
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Producto</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 14.5 }}>
              <li><a href="#como-funciona">Cómo funciona</a></li>
              <li><a href="#funciones">Funciones</a></li>
              <li><a href="#precios">Precios</a></li>
              <li><a href="#demo">Demo del producto</a></li>
            </ul>
          </nav>
          <nav aria-label="Industrias">
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Industrias</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 14.5 }}>
              <li><a href="#industrias">Peluquerías y barberías</a></li>
              <li><a href="#industrias">Dentistas</a></li>
              <li><a href="#industrias">Clínicas estéticas</a></li>
              <li><a href="#industrias">Spas</a></li>
            </ul>
          </nav>
          <nav aria-label="Empresa y legal">
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Empresa</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 14.5 }}>
              <li><a href={`mailto:${LEGAL.contactEmail}`}>Contacto</a></li>
              <li><Link href="/privacy">Aviso de privacidad</Link></li>
              <li><Link href="/terms">Términos y condiciones</Link></li>
              <li><a href="#faq">Preguntas frecuentes</a></li>
            </ul>
          </nav>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="cv-container" style={{ padding: '20px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <p style={{ margin: 0 }}>© 2026 {LEGAL.legalName}. Todos los derechos reservados.</p>
            <p style={{ margin: '0 0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} /> Hecho en México 🇲🇽</p>
          </div>
        </div>
      </footer>

      {/* CTA flotante */}
      <Link
        href="/signup"
        aria-label="Empezar prueba gratis con ChatVenti"
        className="cv-btn-green cv-pulse"
        style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 24px', fontSize: 15.5, boxShadow: '0 12px 30px rgba(18,140,74,0.4)' }}
      >
        <WhatsAppIcon />
        Prueba gratis
      </Link>
    </div>
  )
}
