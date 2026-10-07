import type { CSSProperties } from 'react'
import type { Metadata } from 'next'

// Marca con la que se muestra ChatVenti: la propia o la de un socio interno
// (¡Pasen!) para sus negocios y su dominio. Este archivo no toca la base:
// sirve igual en servidor y en cliente.

export type Brand = {
  /** null = ChatVenti. */
  partnerId: string | null
  name: string
  logoUrl: string
  logoWhiteUrl: string
  iconUrl: string
  primaryColor: string
  accentColor: string
  supportEmail: string
  /** Panel del socio al que «volver»; null en ChatVenti. */
  panelUrl: string | null
  /** Host del panel con esta marca (agenda.pasen.mx); null = www.chatventi.com. */
  appDomain: string | null
  emailFrom: string
  /** Frase de apoyo cuando no se nombra a ChatVenti. */
  tagline: string
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

export const CHATVENTI: Brand = {
  partnerId: null,
  name: 'ChatVenti',
  logoUrl: 'https://www.chatventi.com/brand/chatventi-logo.png',
  logoWhiteUrl: 'https://www.chatventi.com/brand/chatventi-logo.png',
  iconUrl: '/brand/chatventi-icon.png',
  primaryColor: '#5b4fe0',
  accentColor: '#ffcd2e',
  supportEmail: 'soporte@chatventi.com',
  panelUrl: null,
  appDomain: null,
  emailFrom: 'ChatVenti <no-reply@chatventi.com>',
  tagline: 'Agenda + recepcionista IA para tu negocio',
}

/** Origen (https://host) donde vive el panel con esta marca. */
export function brandOrigin(brand: Pick<Brand, 'appDomain'>): string {
  return brand.appDomain ? `https://${brand.appDomain}` : SITE_URL
}

// ---------------------------------------------------------------------
// Paleta: las clases bg-brand-500, text-brand-700… leen variables CSS
// (tailwind.config.ts). Para un socio se recalculan a partir de su color.
// ---------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const mix = (c: [number, number, number], to: [number, number, number], t: number) =>
  c.map((v, i) => Math.round(v + (to[i] - v) * t)) as [number, number, number]

/** Escala 50–900 alrededor del color principal del socio (500). */
export function palette(primary: string): Record<string, string> {
  const base = hexToRgb(primary)
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [0, 0, 0]
  const steps: [string, [number, number, number]][] = [
    ['50', mix(base, white, 0.92)],
    ['100', mix(base, white, 0.82)],
    ['200', mix(base, white, 0.64)],
    ['300', mix(base, white, 0.44)],
    ['400', mix(base, white, 0.22)],
    ['500', base],
    ['600', mix(base, black, 0.12)],
    ['700', mix(base, black, 0.24)],
    ['800', mix(base, black, 0.38)],
    ['900', mix(base, black, 0.52)],
  ]
  return Object.fromEntries(steps.map(([k, rgb]) => [`--brand-${k}`, rgb.join(' ')]))
}

/** Variables CSS para envolver una pantalla con la marca del socio; undefined en ChatVenti. */
export function brandStyle(brand: Brand): CSSProperties | undefined {
  return brand.partnerId ? (palette(brand.primaryColor) as CSSProperties) : undefined
}

/**
 * Metadatos de una pantalla con la marca del socio: título, íconos, Open Graph
 * y nombre de la app al instalarla en iOS. Sin socio devuelve solo el título,
 * que hereda la plantilla «%s · ChatVenti» del layout raíz. Las etiquetas no se
 * ven en pantalla, pero son lo que muestra un enlace compartido o el icono en
 * el teléfono: por ahí se colaba «ChatVenti» en agenda.pasen.mx.
 */
export function brandMetadata(brand: Brand, title?: string): Metadata {
  if (!brand.partnerId) return title ? { title } : {}
  const origin = brandOrigin(brand)
  return {
    metadataBase: new URL(origin),
    title: title ? { absolute: `${title} · ${brand.name}` } : { absolute: brand.name, template: `%s · ${brand.name}` },
    description: brand.tagline,
    applicationName: brand.name,
    icons: { icon: brand.iconUrl, apple: brand.iconUrl },
    appleWebApp: { title: brand.name },
    openGraph: { siteName: brand.name, title: brand.name, url: origin, description: brand.tagline, images: [{ url: brand.iconUrl }] },
    twitter: { card: 'summary', title: brand.name, description: brand.tagline, images: [brand.iconUrl] },
  }
}
