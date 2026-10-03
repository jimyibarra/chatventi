import type { ReactNode } from 'react'
import './guia.css'

// Guías públicas (no piden sesión): se pueden mandar por WhatsApp a un dueño.
// Rubik y panel.css ya vienen del layout raíz; aquí solo el marco «Líneas».
export default function AyudaLayout({ children }: { children: ReactNode }) {
  return <div className="cv-panel min-h-screen bg-surface font-sans text-ink">{children}</div>
}
