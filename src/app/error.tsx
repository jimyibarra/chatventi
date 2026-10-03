'use client'

import { ErrorScreen } from '@/shared/components/error-screen'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

// Error inesperado en cualquier pantalla (debajo del layout raíz). Sustituye a
// la pantalla en inglés de Next. `digest` es el identificador que Next deja en
// el registro del servidor: sirve para encontrar el fallo si alguien lo reporta.
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      kind="failed"
      tag="Error"
      title="Algo salió mal"
      detail={error.digest ? `Código del error: ${error.digest}` : undefined}
      actions={
        <>
          <Button onClick={reset}>
            <Icon name="refresh" className="h-[18px] w-[18px]" />
            Intentar de nuevo
          </Button>
          <ButtonLink href="/" variant="secondary">
            Ir al inicio
          </ButtonLink>
        </>
      }
    >
      Fue un error de nuestro lado, no tuyo. Intenta de nuevo; si sigue pasando, vuelve en unos minutos.
    </ErrorScreen>
  )
}
