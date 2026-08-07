import { SignupForm } from '@/features/auth/components/signup-form'
import { verticalBySlug } from '@/features/verticales/data'
import { isTurnstileConfigured } from '@/shared/security/turnstile'

// El giro se lee AQUÍ (servidor) y no con useSearchParams en el formulario:
// useSearchParams obliga a envolver el componente en <Suspense> y convierte
// la página en dinámica de todas formas. Leerlo aquí es más simple y directo.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ giro?: string }>
}) {
  const { giro } = await searchParams
  const vertical = verticalBySlug(giro)

  return (
    <div className="space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Crear cuenta</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {vertical
            ? `Tu agenda + recepcionista IA para ${vertical.noun}, lista en minutos`
            : 'Tu agenda + recepcionista IA, lista en minutos'}
        </p>
      </div>
      {/* El widget anti-bot solo se muestra si el SERVIDOR va a verificarlo
          (TURNSTILE_SECRET_KEY presente). Evita el estado incoherente de
          jul-2026: widget visible con la verificación apagada, que dejaba un
          "Troubleshoot" huérfano sin proteger nada. Una sola llave manda. */}
      <SignupForm vertical={vertical?.slug} antibotEnabled={isTurnstileConfigured()} />
    </div>
  )
}
