'use client'

import './globals.css'
import '@/shared/components/ui/panel.css'
import { ErrorScreen } from '@/shared/components/error-screen'
import { Button } from '@/shared/components/ui/button'

// Último recurso: el fallo está en el propio layout raíz, así que esta pantalla
// trae su <html> y sus estilos. Sin Rubik (vive en el layout que falló): la
// pila de letra cae a la del sistema, nunca a serif.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="bg-surface font-sans text-ink antialiased">
        <ErrorScreen
          kind="failed"
          tag="Error"
          title="Algo salió mal"
          detail={error.digest ? `Código del error: ${error.digest}` : undefined}
          actions={<Button onClick={reset}>Intentar de nuevo</Button>}
        >
          Fue un error de nuestro lado, no tuyo. Intenta de nuevo; si sigue pasando, vuelve en unos minutos.
        </ErrorScreen>
      </body>
    </html>
  )
}
