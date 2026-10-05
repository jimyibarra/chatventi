import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Rubik } from 'next/font/google'
import { LEGAL } from '@/shared/constants/legal'
import { VERTICALS } from '@/features/verticales/data'
import { FOUNDERS, TRIAL_DAYS } from './data'
import { Check } from './check'

// Piezas compartidas de las páginas públicas «Líneas» (home y /para/*): letra,
// barra, pie, giros, fundadores y cierre. Estilos en lineas-landing.css (.lx).
// `base` = '' en la home (anclas locales) o '/' fuera de ella (anclas de la home).

/** Rubik con el 800 de los titulares; la variable la lee `--ff` en .lx. */
export const lxFont = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-lx' })

export const CTA = `Prueba gratis ${TRIAL_DAYS} días`

export function Logo({ base = '' }: { base?: string }) {
  return (
    <Link className="logo" href={base ? '/' : '#top'}>
      <Image src="/brand/chatventi-icon.png" alt="" width={34} height={34} priority />
      ChatVenti
    </Link>
  )
}

export function TopBar({ base = '', signupHref = '/signup' }: { base?: string; signupHref?: string }) {
  return (
    <header className="bar">
      <div className="wrap">
        <Logo base={base} />
        <nav aria-label="Secciones">
          <Link href={`${base}#dia`}>Cómo funciona</Link>
          <Link href={`${base}#panel`}>Tu panel</Link>
          <Link href={`${base}#precios`}>Precios</Link>
          <Link href={`${base}#preguntas`}>Preguntas</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        <Link className="btn btn-primary" href={signupHref}>{CTA}</Link>
      </div>
    </header>
  )
}

export function Checks({ items }: { items: string[] }) {
  return <ul className="checks">{items.map((t) => <li key={t}><Check />{t}</li>)}</ul>
}

/** Pictogramas al estilo de la señalética del Metro, uno por giro con landing propia. */
export const GIROS: { slug: string; title: string; body: string; color: string; picto: ReactNode }[] = [
  { slug: 'barberia', title: 'Barberías y estéticas', body: 'Cortes, color y peinado con el profesional que el cliente pide.', color: '#e0007a', picto: <><circle cx="13" cy="35" r="6" /><circle cx="35" cy="35" r="6" /><path d="M17.5 31 37 8M30.5 31 11 8" /></> },
  { slug: 'dentista', title: 'Dentistas', body: 'Primera consulta, limpieza y seguimiento, con su duración real.', color: '#0b5bd3', picto: <path d="M24 11c-3-3-12-4-14 3-1.7 6 2 9 3 14 1 5 1.5 12 5 12 3 0 2.5-9 6-9s3 9 6 9c3.5 0 4-7 5-12 1-5 4.7-8 3-14-2-7-11-6-14-3Z" /> },
  { slug: 'veterinaria', title: 'Veterinarias', body: 'Consultas, vacunas y baño, con recordatorio para la próxima dosis.', color: '#00a35c', picto: <><ellipse cx="24" cy="32" rx="9" ry="7" /><circle cx="12" cy="20" r="4" /><circle cx="36" cy="20" r="4" /><circle cx="19" cy="11" r="4" /><circle cx="29" cy="11" r="4" /></> },
  { slug: 'spa', title: 'Spas y uñas', body: 'Paquetes, servicios dobles y huecos que se llenan solos.', color: '#f08c00', picto: <><path d="M24 40c-8-4-12-10-12-17 5 0 9 3 12 8 3-5 7-8 12-8 0 7-4 13-12 17Z" /><path d="M24 31c-2.5-5-2.5-12 0-20 2.5 8 2.5 15 0 20Z" /></> },
  { slug: 'consultorio-medico', title: 'Consultorios', body: 'Citas de primera vez y de seguimiento, sin choques de horario.', color: '#5b4fe0', picto: <><path d="M13 8v10a8 8 0 0 0 16 0V8" /><path d="M21 26v5a8 8 0 0 0 16 0v-4" /><circle cx="37" cy="23" r="4" /></> },
]

export function Picto({ slug, size = 46 }: { slug: string; size?: number }) {
  const g = GIROS.find((x) => x.slug === slug)
  if (!g) return null
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {g.picto}
    </svg>
  )
}

export function Giros({ exclude, title = 'Hecha para negocios que viven de su agenda', lead = 'Cada giro tiene su propia forma de agendar. La recepcionista ya la conoce.' }: { exclude?: string; title?: string; lead?: string }) {
  const list = GIROS.filter((g) => g.slug !== exclude)
  return (
    <section className="s giros" data-live aria-labelledby="giros-t">
      <div className="wrap">
        <div className="s-head">
          <h2 id="giros-t">{title}</h2>
          <p>{lead}</p>
        </div>
        <div className="giro-line" style={{ '--n': list.length } as CSSProperties}>
          <span className="rail" aria-hidden="true"><span className="train" /></span>
          {/* Cada estación ENLAZA a su landing por giro: es la entrada a /para/*. */}
          {list.map((g) => (
            <Link key={g.slug} className="giro" href={`/para/${g.slug}`}>
              <span className="picto" style={{ background: g.color }}><Picto slug={g.slug} /></span>
              <h3>{g.title}</h3><p>{g.body}</p><span className="go">Ver cómo funciona</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Founders({ taken, href = FOUNDERS.href }: { taken: number; href?: string }) {
  return (
    <section className="s found" aria-labelledby="found-t">
      <div className="wrap">
        <div>
          <div className="s-head">
            <h2 id="found-t">Buscamos {FOUNDERS.seats} negocios fundadores</h2>
            <p>Todavía no tenemos testimonios y no te vamos a inventar uno. Por eso buscamos {FOUNDERS.seats} negocios para crecer con ellos.</p>
          </div>
          <div className="seats" role="img" aria-label={`${FOUNDERS.seats} lugares para negocios fundadores, ${taken} ocupados`}>
            {Array.from({ length: FOUNDERS.seats }, (_, i) => <i key={i} className={i < taken ? 'on' : undefined} />)}
          </div>
        </div>
        <div className="give">
          <h3>Lo que recibes</h3>
          <Checks items={FOUNDERS.gives} />
          <p className="ask"><b>Lo que te pedimos:</b> {FOUNDERS.asks.charAt(0).toLowerCase() + FOUNDERS.asks.slice(1)}</p>
          <Link className="btn btn-primary" href={href}>{FOUNDERS.cta}</Link>
        </div>
      </div>
    </section>
  )
}

export function Close({ signupHref = '/signup', faqHref = '#preguntas' }: { signupHref?: string; faqHref?: string }) {
  return (
    <section className="s close" aria-labelledby="close-t">
      <svg className="deco" viewBox="0 0 560 300" aria-hidden="true">
        <path pathLength={1} d="M0 240 C 160 240, 220 150, 360 170 S 520 260, 600 220" stroke="#e0007a" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path pathLength={1} d="M40 300 C 200 280, 300 230, 420 250 S 560 300, 620 290" stroke="#0b5bd3" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path pathLength={1} d="M260 0 C 300 80, 380 110, 600 90" stroke="#00a35c" strokeWidth="12" fill="none" strokeLinecap="round" />
        <circle cx="360" cy="170" r="13" fill="#ffcd2e" stroke="#2a1a5e" strokeWidth="5" />
        <circle cx="420" cy="250" r="13" fill="#fff" stroke="#0b5bd3" strokeWidth="6" />
        <circle cx="440" cy="104" r="13" fill="#fff" stroke="#00a35c" strokeWidth="6" />
      </svg>
      <div className="wrap">
        <h2 id="close-t">Mientras lees esto, alguien le escribe a tu competencia.</h2>
        <p>Pon a tu recepcionista a contestar hoy y no vuelvas a perder una cita por no responder a tiempo.</p>
        <div className="cta-row">
          <Link className="btn btn-amber" href={signupHref}>{CTA}</Link>
          <a className="btn btn-line" href={faqHref}>Tengo una duda</a>
        </div>
      </div>
    </section>
  )
}

/** Lo que va en todos los planes y la verdad sobre lo que cobra Meta. */
export function AllIn() {
  return (
    <div className="allin">
      <div><b>En todos los planes:</b> WhatsApp, Instagram, Messenger, Telegram, tu página de reservas, recordatorios y la ficha de cada cliente.</div>
      <div><b>Sobre WhatsApp:</b> Meta cobra sus mensajes aparte y regala 1,000 de servicio al mes por número. Tu tarjeta la pones en Meta, no en ChatVenti. Instagram y Messenger no tienen costo por mensaje.</div>
    </div>
  )
}

/** Pie: producto, guías paso a paso, documentos legales y entrada a cada giro. */
export function Footer({ base = '' }: { base?: string }) {
  return (
    <footer>
      <div className="wrap foot">
        <div className="foot-brand">
          <Logo base={base} />
          <p>La recepcionista con IA que agenda citas por WhatsApp, Instagram y Messenger.</p>
        </div>
        <nav aria-labelledby="foot-producto">
          <h2 id="foot-producto">Producto</h2>
          <Link href={`${base}#dia`}>Cómo funciona</Link>
          <Link href={`${base}#precios`}>Precios</Link>
          <Link href={`${base}#preguntas`}>Preguntas frecuentes</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        <nav aria-labelledby="foot-guias">
          <h2 id="foot-guias">Guías paso a paso</h2>
          <Link href="/ayuda/whatsapp">Conecta tu WhatsApp</Link>
          <Link href="/ayuda/facebook-instagram">Conecta Facebook e Instagram</Link>
        </nav>
        <nav aria-labelledby="foot-legal">
          <h2 id="foot-legal">Legal</h2>
          <Link href="/privacy">Aviso de privacidad</Link>
          <Link href="/terms">Términos y condiciones</Link>
          <a href={`mailto:${LEGAL.contactEmail}`}>Contacto: {LEGAL.contactEmail}</a>
        </nav>
        <nav className="giros-nav" aria-label="ChatVenti por giro de negocio">
          {VERTICALS.map((v) => <Link key={v.slug} href={`/para/${v.slug}`}>{v.label}</Link>)}
        </nav>
      </div>
    </footer>
  )
}
