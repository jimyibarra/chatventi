import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { WelcomeWizard } from '@/features/onboarding/components/welcome-wizard'

export const dynamic = 'force-dynamic'

// Asistente que crea el negocio, para cuentas ya verificadas y sin
// organización. Vive FUERA del grupo (main) a propósito: aquel layout da por
// hecho que existe una organización (menú, gates de plan) y aquí todavía no.
export default async function BienvenidaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // .eq('id', user.id) NO es opcional: la policy de lectura deja ver los
  // perfiles de toda la organización (CLAUDE.md 2026-07-15).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  // Ya tiene negocio: aquí no pinta nada.
  if (profile) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-soft px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <Image
            src="/brand/chatventi-logo.png"
            alt="ChatVenti"
            width={150}
            height={38}
            className="mx-auto h-9 w-auto"
            priority
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            ¡Tu correo está confirmado!
          </h1>
          <p className="text-sm text-ink-muted">
            Solo faltan dos datos para dejar tu agenda y tu recepcionista IA funcionando.
          </p>
        </div>
        <WelcomeWizard />
      </div>
    </main>
  )
}
