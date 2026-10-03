import type { Metadata } from 'next'
import { ErrorScreen } from '@/shared/components/error-screen'
import { ButtonLink } from '@/shared/components/ui/button'

export const metadata: Metadata = { title: 'Página no encontrada' }

// 404 de toda la app. También la ven los clientes finales cuando abren un
// enlace de reserva (/r/…) o de cita (/c/…) que ya no existe.
export default function NotFound() {
  return (
    <ErrorScreen
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
