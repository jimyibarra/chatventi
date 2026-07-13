import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/shared/components/pwa-register'

export const metadata: Metadata = {
  title: 'ChatVenti',
  description: 'Agenda + recepcionista IA para tu negocio, por WhatsApp, Telegram y web.',
  manifest: '/manifest.json',
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
