import { Rubik } from 'next/font/google'
import type { ReactNode } from 'react'
import '@/shared/components/ui/panel.css'
import './guia.css'

// Guías públicas (no piden sesión): se pueden mandar por WhatsApp a un dueño.
// Misma tipografía y detalles del panel «Líneas».
const rubik = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-rubik' })

export default function AyudaLayout({ children }: { children: ReactNode }) {
  return <div className={`${rubik.variable} cv-panel min-h-screen bg-surface font-sans text-ink`}>{children}</div>
}
