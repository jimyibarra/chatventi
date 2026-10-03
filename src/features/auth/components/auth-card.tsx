import type { ReactNode } from 'react'
import { Card } from '@/shared/components/ui/card'

/** Tarjeta de un formulario de acceso: título de página (28 px) y su explicación. */
export function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <Card padded={false} className="p-5 sm:p-8">
      <header className="mb-6">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] leading-snug text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </Card>
  )
}
