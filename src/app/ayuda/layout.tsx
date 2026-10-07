import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { brandStyle, currentBrand } from '@/features/marca/brand'
import { brandMetadata } from '@/features/marca/brand-shared'
import './guia.css'

// Guías públicas (no piden sesión): se pueden mandar por WhatsApp a un dueño.
// Rubik y panel.css ya vienen del layout raíz; aquí solo el marco «Líneas».
// En el dominio de un socio (agenda.pasen.mx) llevan su marca y su nombre.
export async function generateMetadata(): Promise<Metadata> {
  return brandMetadata(await currentBrand())
}

export default async function AyudaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cv-panel min-h-screen bg-surface font-sans text-ink" style={brandStyle(await currentBrand())}>
      {children}
    </div>
  )
}
