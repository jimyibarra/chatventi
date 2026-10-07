import type { Metadata } from 'next'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { currentBrand } from '@/features/marca/brand'
import { brandMetadata } from '@/features/marca/brand-shared'

// Acceso (login, registro, recuperar y nueva contraseña) en diseño «Líneas».
// En el dominio de un socio (agenda.pasen.mx) va con su marca.
export async function generateMetadata(): Promise<Metadata> {
  return brandMetadata(await currentBrand())
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell brand={await currentBrand()}>{children}</AuthShell>
}
