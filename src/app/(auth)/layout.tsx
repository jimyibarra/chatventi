import type { Metadata } from 'next'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { currentBrand } from '@/features/marca/brand'

// Acceso (login, registro, recuperar y nueva contraseña) en diseño «Líneas».
// En el dominio de un socio (agenda.pasen.mx) va con su marca.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await currentBrand()
  if (!brand.partnerId) return {}
  return { title: { absolute: brand.name, template: `%s · ${brand.name}` }, icons: { icon: brand.iconUrl } }
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell brand={await currentBrand()}>{children}</AuthShell>
}
