import type { Metadata } from 'next'
import { SignupForm } from '@/features/auth/components/signup-form'
import { AuthCard } from '@/features/auth/components/auth-card'
import { verticalBySlug } from '@/features/verticales/data'

export const metadata: Metadata = { title: 'Crear cuenta' }

// El giro se lee AQUÍ (servidor) y no con useSearchParams en el formulario:
// useSearchParams obliga a envolver el componente en <Suspense> y convierte
// la página en dinámica de todas formas. Leerlo aquí es más simple y directo.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ giro?: string; ref?: string }>
}) {
  const { giro, ref } = await searchParams
  const vertical = verticalBySlug(giro)

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle={
        vertical
          ? `Tu agenda + recepcionista IA para ${vertical.noun}, lista en minutos.`
          : 'Tu agenda + recepcionista IA, lista en minutos.'
      }
    >
      {/* El captcha lo verifica ahora Supabase Auth (GoTrue). El widget se
          auto-oculta si no hay NEXT_PUBLIC_TURNSTILE_SITE_KEY, así que el
          registro sigue funcionando en desarrollo y mientras esté apagado. */}
      <SignupForm vertical={vertical?.slug} referral={ref} />
    </AuthCard>
  )
}
