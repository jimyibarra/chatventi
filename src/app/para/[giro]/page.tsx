import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Inter, Manrope } from 'next/font/google'
import { LEGAL } from '@/shared/constants/legal'
import { pageMetadata } from '@/shared/lib/seo'
import { STARTER_PRICE_USD } from '@/features/billing/plans'
import { FEATURES, PRICING, TESTIMONIALS, TRIAL_DAYS } from '@/features/landing/data'
import { Icon } from '@/features/landing/icons'
import { VERTICALS, verticalBySlug } from '@/features/verticales/data'
import { verticalContent } from '@/features/verticales/content'
import '@/features/landing/landing.css'

const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-manrope' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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
  return pageMetadata({
    title: content.metaTitle,
    description: content.metaDescription,
    path: `/para/${giro}`,
  })
}

const H3: CSSProperties = { fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 800, fontSize: 20, margin: '0 0 10px' }
const BODY_MUTED: CSSProperties = { color: '#5F5A75', fontSize: 15.5, lineHeight: 1.6, margin: 0 }

export default async function VerticalPage({ params }: { params: Promise<{ giro: string }> }) {
  const { giro } = await params
  const vertical = verticalBySlug(giro)
  const content = verticalContent(giro)
  // dynamicParams=false ya devuelve 404 para slugs fuera de generateStaticParams;
  // esto cubre el caso de un slug en el catálogo al que le falte el copy.
  if (!vertical || !content) notFound()

  // El giro viaja al registro para llegar preseleccionado a /bienvenida.
  const signupHref = `/signup?giro=${vertical.slug}`

  // FAQ propias del giro. No se mezclan con las de la home: dos FAQPage
  // distintas compitiendo en la misma URL confunden a Google.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: LEGAL.siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: vertical.label,
        item: `${LEGAL.siteUrl}/para/${vertical.slug}`,
      },
    ],
  }

  return (
    <div className={`${manrope.variable} ${inter.variable} cv-landing`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* ============ HEADER ============ */}
      <header className="cv-header">
        <div className="cv-container" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link href="/" aria-label="ChatVenti — inicio" style={{ display: 'flex', alignItems: 'center' }}>
            <Image src="/brand/chatventi-logo.png" alt="ChatVenti" width={168} height={62} priority style={{ height: 38, width: 'auto' }} />
          </Link>
          <nav aria-label="Navegación principal" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            <Link className="cv-navlink" href="/#funciones">Funciones</Link>
            <Link className="cv-navlink" href="/#precios">Precios</Link>
            <Link className="cv-navlink" href="/login">Entrar</Link>
          </nav>
          <Link href={signupHref} className="cv-btn-primary" style={{ padding: '11px 22px', fontSize: 15 }}>Prueba gratis</Link>
        </div>
      </header>

      <main>
        {/* ============ HERO ============ */}
        <section aria-label={`ChatVenti para ${vertical.label}`} style={{ background: 'linear-gradient(180deg, #F4F2FE 0%, #FBFAF6 78%)' }}>
          <div className="cv-container" style={{ padding: '72px 24px 56px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 420px', minWidth: 300 }}>
              <p style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 0 22px', background: '#EFEDFB', color: '#4A3FC4', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 999 }}>
                <span aria-hidden>{vertical.emoji}</span> Hecho para {vertical.label.toLowerCase()}
              </p>
              <h1 className="cv-h1" style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', lineHeight: 1.1, margin: '0 0 20px' }}>
                {content.h1}
              </h1>
              <p style={{ fontSize: 'clamp(17px, 2vw, 20px)', lineHeight: 1.6, color: '#5F5A75', margin: '0 0 30px' }}>
                {content.subtitle}
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <Link href={signupHref} className="cv-btn-primary" style={{ padding: '16px 34px', fontSize: 17 }}>
                  Empezar prueba gratis
                </Link>
                <Link href="/#demo" className="cv-btn-ghost" style={{ padding: '15px 24px', fontSize: 16 }}>Ver el producto</Link>
              </div>
              <p style={{ fontSize: 14, color: '#7A758F', margin: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>✓ {TRIAL_DAYS} días de prueba gratis</span><span>✓ Sin tarjeta de crédito</span><span>✓ Listo en minutos</span>
              </p>
            </div>

            {/* Foto del giro. `priority` porque es el LCP de esta página. */}
            <div style={{ flex: '1 1 380px', minWidth: 280 }}>
              <Image
                src={`/verticales/${vertical.slug}.webp`}
                alt={content.imageAlt}
                width={1024}
                height={1024}
                priority
                sizes="(max-width: 900px) 100vw, 45vw"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 420,
                  objectFit: 'cover',
                  borderRadius: 20,
                  boxShadow: '0 18px 44px rgba(32,27,54,0.16)',
                }}
              />
            </div>
          </div>
        </section>

        {/* ============ DOLORES ============ */}
        <section style={{ background: '#fff', borderTop: '1px solid #ECE9F5' }}>
          <div className="cv-container" style={{ padding: '64px 24px' }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">El problema</p>
              <h2 className="cv-h2">Lo que te pasa hoy</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 24 }}>
              {content.pains.map((p) => (
                <div key={p.title} className="cv-card" style={{ padding: 26 }}>
                  <h3 style={H3}>{p.title}</h3>
                  <p style={BODY_MUTED}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ BENEFICIOS DEL GIRO ============ */}
        <section style={{ background: '#FBFAF6' }}>
          <div className="cv-container" style={{ padding: '64px 24px' }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">La solución</p>
              <h2 className="cv-h2">ChatVenti para {vertical.label.toLowerCase()}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 24 }}>
              {content.benefits.map((b) => (
                <div key={b.title} className="cv-card" style={{ padding: 26 }}>
                  <h3 style={H3}>{b.title}</h3>
                  <p style={BODY_MUTED}>{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FUNCIONES (compartidas) ============ */}
        <section style={{ background: '#fff', borderTop: '1px solid #ECE9F5' }}>
          <div className="cv-container" style={{ padding: '64px 24px' }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">Funciones</p>
              <h2 className="cv-h2">Todo lo que incluye</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 24 }}>
              {FEATURES.map((f) => (
                <div key={f.title} className="cv-card" style={{ padding: 26 }}>
                  <span aria-hidden style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 12, background: f.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Icon name={f.icon} stroke={f.stroke} />
                  </span>
                  <h3 style={H3}>{f.title}</h3>
                  <p style={BODY_MUTED}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ TESTIMONIOS (compartidos) ============ */}
        <section style={{ background: '#FBFAF6' }}>
          <div className="cv-container" style={{ padding: '64px 24px' }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">Testimonios</p>
              <h2 className="cv-h2">Negocios que ya no pierden citas</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="cv-card" style={{ padding: 26, margin: 0 }}>
                  <blockquote style={{ ...BODY_MUTED, margin: '0 0 18px' }}>{t.quote}</blockquote>
                  <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span aria-hidden style={{ display: 'inline-flex', width: 42, height: 42, borderRadius: '50%', background: t.bg, color: t.fg, alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {t.initials}
                    </span>
                    <span>
                      <strong style={{ display: 'block', fontSize: 15 }}>{t.name}</strong>
                      <span style={{ fontSize: 13.5, color: '#7A758F' }}>{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ============ PRECIO ============ */}
        <section style={{ background: '#fff', borderTop: '1px solid #ECE9F5' }}>
          <div className="cv-container" style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">Precios</p>
              <h2 className="cv-h2">Desde ${STARTER_PRICE_USD} USD al mes</h2>
              <p className="cv-lead">
                {PRICING.popular.name} por ${PRICING.popular.price} USD/mes. Empieza con {TRIAL_DAYS} días
                de prueba gratis, sin tarjeta de crédito.
              </p>
            </div>
            <Link href={signupHref} className="cv-btn-primary" style={{ padding: '16px 34px', fontSize: 17 }}>
              Empezar prueba gratis
            </Link>
            <p style={{ marginTop: 14, fontSize: 14, color: '#7A758F' }}>
              <Link href="/#precios" className="cv-navlink">Ver todos los planes →</Link>
            </p>
          </div>
        </section>

        {/* ============ FAQ DEL GIRO ============ */}
        <section style={{ background: '#FBFAF6' }}>
          <div className="cv-container" style={{ padding: '64px 24px', maxWidth: 820 }}>
            <div className="cv-section-head">
              <p className="cv-eyebrow">Preguntas</p>
              <h2 className="cv-h2">Dudas de {vertical.label.toLowerCase()}</h2>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {content.faqs.map((f) => (
                <details key={f.q} className="cv-card" style={{ padding: '20px 24px' }}>
                  <summary style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
                    {f.q}
                  </summary>
                  <p style={{ ...BODY_MUTED, marginTop: 12 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============ OTROS GIROS (enlazado interno) ============ */}
        <section style={{ background: '#fff', borderTop: '1px solid #ECE9F5' }}>
          <div className="cv-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9B96B0' }}>
              ChatVenti también sirve para
            </p>
            <div style={{ display: 'flex', gap: '12px 28px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {VERTICALS.filter((v) => v.slug !== vertical.slug).map((v) => (
                <Link key={v.slug} href={`/para/${v.slug}`} className="cv-navlink" style={{ fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 700, fontSize: 16 }}>
                  {v.emoji} {v.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: '#201B36', color: '#C9C4DC' }}>
        <div className="cv-container" style={{ padding: '36px 24px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
          <span>© {new Date().getFullYear()} {LEGAL.brand}</span>
          <span style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href="/" className="cv-navlink">Inicio</Link>
            <Link href="/privacy" className="cv-navlink">Privacidad</Link>
            <Link href="/terms" className="cv-navlink">Términos</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
