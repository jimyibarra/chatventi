import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'
import { pageMetadata } from '@/shared/lib/seo'
import { visitorCurrency } from '@/features/billing/currency'
import { FARES, FEATURES, FOUNDERS, PROOF, TRIAL_DAYS } from '@/features/landing/data'
import { foundersTaken } from '@/features/landing/founders'
import { AllIn, CTA, Close, Footer, Founders, GIROS, Giros, Picto, TopBar, lxFont } from '@/features/landing/chrome'
import { LiveSections } from '@/features/landing/hero-scene'
import { Fares } from '@/features/landing/fares'
import { FaqList } from '@/features/landing/faq-list'
import { SalesWidget } from '@/features/landing/sales-widget'
import { Check } from '@/features/landing/check'
import { VERTICALS, verticalBySlug } from '@/features/verticales/data'
import { verticalContent, type VerticalContent } from '@/features/verticales/content'
import '@/features/landing/lineas-landing.css'

// Landing por giro en «Líneas», con las mismas piezas que la home (barra, pie,
// tarifa, fundadores, cierre). El color de la página es la línea de su giro.
// Respaldo del diseño anterior: etiqueta git `respaldo-para-diseno-anterior`.

// Estáticas: son 5 páginas de marketing que solo cambian al editar el copy.
export const dynamicParams = false

export function generateStaticParams() {
  return VERTICALS.map((v) => ({ giro: v.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ giro: string }> }) {
  const { giro } = await params
  const content = verticalContent(giro)
  if (!content) return {}
  // pageMetadata() y no un objeto a mano: Next NO hace deep-merge de
  // openGraph/twitter y se perderían los defaults del layout.
  return pageMetadata({ title: content.metaTitle, description: content.metaDescription, path: `/para/${giro}` })
}

export default async function VerticalPage({ params }: { params: Promise<{ giro: string }> }) {
  const { giro } = await params
  const vertical = verticalBySlug(giro)
  const content = verticalContent(giro)
  // dynamicParams=false ya devuelve 404 para slugs fuera de generateStaticParams;
  // esto cubre el caso de un slug en el catálogo al que le falte el copy.
  if (!vertical || !content) notFound()
  // Pesos más IVA para quien visita desde México; dólares para el resto.
  const [currency, taken] = await Promise.all([visitorCurrency(), foundersTaken()])

  // El giro viaja al registro para llegar preseleccionado a /bienvenida.
  const signupHref = `/signup?giro=${vertical.slug}`
  const color = GIROS.find((g) => g.slug === vertical.slug)?.color ?? '#5b4fe0'
  const label = vertical.label.toLowerCase()

  // FAQ propias del giro. No se mezclan con las de la home: dos FAQPage
  // distintas compitiendo en la misma URL confunden a Google.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: LEGAL.siteUrl },
      { '@type': 'ListItem', position: 2, name: vertical.label, item: `${LEGAL.siteUrl}/para/${vertical.slug}` },
    ],
  }

  return (
    <div className={`${lxFont.variable} lx`} style={{ '--c': color } as CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <TopBar base="/" signupHref={signupHref} />
      <main id="top">
        <section className="hero vhero" aria-label={`ChatVenti para ${label}`}>
          <div className="wrap">
            <div>
              <p className="vchip">
                <span className="vpicto"><Picto slug={vertical.slug} size={20} /></span>
                Hecho para {label}
              </p>
              <h1>{content.h1}</h1>
              <p className="lede">{content.subtitle}</p>
              <div className="cta-row">
                <Link className="btn btn-primary" href={signupHref}>{CTA}</Link>
                <a className="btn btn-ghost" href="#precios">Ver precios</a>
              </div>
              <ul className="facts">
                {['Sin tarjeta de crédito', 'Lista en minutos', 'API oficial de Meta'].map((t) => <li key={t}><Check />{t}</li>)}
              </ul>
            </div>
            {/* Foto del giro. `priority` porque es el LCP de esta página. */}
            <figure className="vphoto">
              <Image src={`/verticales/${vertical.slug}.webp`} alt={content.imageAlt} width={1024} height={1024} priority sizes="(max-width: 920px) 100vw, 46vw" />
              <figcaption><i />Contesta por WhatsApp, Instagram y Messenger</figcaption>
            </figure>
          </div>
        </section>
        <Pains content={content} />
        <Benefits content={content} label={label} />
        <Included />
        <section className="s" aria-labelledby="prueba-t">
          <div className="wrap">
            <div className="s-head">
              <h2 id="prueba-t">No nos creas: pruébalo</h2>
              <p>Solo lo que puedes comprobar hoy, sin testimonios inventados.</p>
            </div>
            <div className="callouts">
              {PROOF.map((p) => <div key={p.title}><b>{p.title}</b><p>{p.body}</p></div>)}
            </div>
          </div>
        </section>
        <Founders taken={taken} href={`${FOUNDERS.href}&giro=${vertical.slug}`} />
        <section className="s prices" id="precios" aria-labelledby="precios-t">
          <div className="wrap">
            <Fares fares={FARES} initial={currency} trialDays={TRIAL_DAYS} signupHref={signupHref} title={`Precios para ${label}`} />
            <AllIn />
          </div>
        </section>
        <section className="s" id="preguntas" aria-labelledby="faq-t">
          <div className="wrap">
            <div className="s-head"><h2 id="faq-t">Dudas de {label}</h2></div>
            <FaqList faqs={content.faqs} />
          </div>
        </section>
        <Giros exclude={vertical.slug} title="ChatVenti también sirve para" lead="Cada giro con su propia forma de agendar." />
        <Close signupHref={signupHref} />
      </main>
      <Footer base="/" />
      <LiveSections />
      {/* Mismo asistente de ventas que la home: es la prueba en vivo. */}
      <SalesWidget />
    </div>
  )
}

/** Lo que se pierde hoy: estaciones de «No llegó» (aro rojo con equis). */
function Pains({ content }: { content: VerticalContent }) {
  return (
    <section className="s day" aria-labelledby="dolor-t">
      <div className="wrap">
        <div className="s-head"><h2 id="dolor-t">Lo que te pasa hoy</h2></div>
        <ul className="pains">
          {content.pains.map((p) => (
            <li key={p.title}>
              <span className="x" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Lo que cambia: una línea del color del giro, una estación por beneficio. */
function Benefits({ content, label }: { content: VerticalContent; label: string }) {
  return (
    <section className="s" aria-labelledby="benef-t">
      <div className="wrap">
        <div className="s-head"><h2 id="benef-t">ChatVenti para {label}</h2></div>
        <ol className="vroute">
          {content.benefits.map((b) => (
            <li key={b.title}><span className="dot" aria-hidden="true"><Check /></span><h3>{b.title}</h3><p>{b.body}</p></li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Todo lo que incluye, en lista: lo mismo en todos los giros. */
function Included() {
  return (
    <section className="s day" aria-labelledby="incl-t">
      <div className="wrap">
        <div className="s-head">
          <h2 id="incl-t">Todo lo que incluye</h2>
          <p>Lo mismo que usan los demás giros, con la configuración del tuyo.</p>
        </div>
        <ul className="incl">
          {FEATURES.map((f) => (
            <li key={f.title}><Check /><span><b>{f.title}</b>{f.body}</span></li>
          ))}
        </ul>
      </div>
    </section>
  )
}
