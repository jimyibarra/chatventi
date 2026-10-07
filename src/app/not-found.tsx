import type { Metadata } from 'next'
import { ErrorScreen } from '@/shared/components/error-screen'
import { ButtonLink } from '@/shared/components/ui/button'
import { currentBrand } from '@/features/marca/brand'
import { brandMetadata } from '@/features/marca/brand-shared'

export async function generateMetadata(): Promise<Metadata> {
  return brandMetadata(await currentBrand(), 'Página no encontrada')
}

// 404 de toda la app. También la ven los clientes finales cuando abren un
// enlace de reserva (/r/…) o de cita (/c/…) que ya no existe.
export default async function NotFound() {
  const brand = await currentBrand()
  return (
    <ErrorScreen
      brandName={brand.name}
      iconUrl={brand.iconUrl}
      kind="missing"
      tag="Error 404"
      title="Esta página no existe"
      actions={
        <>
          <ButtonLink href="/">Ir al inicio</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Entrar a mi cuenta
          </ButtonLink>
        </>
      }
    >
      Puede que el enlace esté incompleto o que la página ya no esté disponible. Si un negocio te lo
      envió, pídele que te lo mande de nuevo.
    </ErrorScreen>
  )
}
