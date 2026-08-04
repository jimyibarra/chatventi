import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LEGAL } from '@/shared/constants/legal'
import { PwaRegister } from '@/shared/components/pwa-register'

const DESCRIPTION = 'Agenda + recepcionista IA para tu negocio, por WhatsApp, Telegram y web.'

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
    <html lang="es">
      <body className="bg-surface text-ink antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
