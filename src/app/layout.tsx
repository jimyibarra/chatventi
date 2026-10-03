import type { Metadata, Viewport } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import '@/shared/components/ui/panel.css'
import { LEGAL } from '@/shared/constants/legal'
import { PwaRegister } from '@/shared/components/pwa-register'

const DESCRIPTION = 'Agenda + recepcionista IA para tu negocio, por WhatsApp, Telegram y web.'

// Tipografía del diseño «Líneas» para TODA la app: acceso, alta, super admin,
// páginas públicas del cliente final y errores. Antes solo la cargaba el panel
// y fuera de él la variable no existía: la pila `font-sans` quedaba inválida y
// el navegador caía a su letra por defecto (Times). La home y /para/* fijan su
// propia letra en `.cv-landing`, así que no la usan: por eso `preload: false`
// (precargarla ahí sería una descarga que nadie usa y Chrome la marca en consola).
const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rubik',
  preload: false,
})

export const metadata: Metadata = {
  // metadataBase es OBLIGATORIO para que Next resuelva a absolutas las URLs de
  // openGraph/canonical. Sin él salen relativas y ni Google ni el depurador de
  // Meta las resuelven. Apunta al host canónico (www), no al apex que redirige.
  metadataBase: new URL(LEGAL.siteUrl),
  title: {
    default: 'ChatVenti',
    // Las páginas que definan `title` heredan el sufijo de marca.
    template: '%s · ChatVenti',
  },
  description: DESCRIPTION,
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: LEGAL.brand,
    locale: 'es_MX',
    url: '/',
    title: 'ChatVenti',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatVenti',
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChatVenti',
  },
}

export const viewport: Viewport = {
  themeColor: '#5b4fe0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={rubik.variable}>
      <body className="bg-surface font-sans text-ink antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
