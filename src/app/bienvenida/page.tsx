import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WelcomeWizard } from '@/features/onboarding/components/welcome-wizard'
import { BUSINESS_TEMPLATES } from '@/features/agente-ia/business-templates'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { AuthCard } from '@/features/auth/components/auth-card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Configura tu negocio' }

// Asistente que crea el negocio, para cuentas ya verificadas y sin
// organización. Vive FUERA del grupo (main) a propósito: aquel layout da por
// hecho que existe una organización (menú, gates de plan) y aquí todavía no.
// Usa el mismo armazón que el registro: es su segundo paso.
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

  // Giro de la landing por la que entró (/para/<giro> → /signup?giro=…). Se
  // revalida contra las plantillas: user_metadata es escribible por el propio
  // usuario, así que su contenido no se da por bueno. Si no encaja, el
  // asistente cae a su valor por defecto.
  const pending = user.user_metadata?.pending_business_type
  const defaultBusinessType =
    typeof pending === 'string' && BUSINESS_TEMPLATES.some((t) => t.key === pending)
      ? pending
      : undefined

  return (
    <AuthShell>
      <AuthCard
        title="¡Tu correo está confirmado!"
        subtitle="Solo faltan dos datos para dejar tu agenda y tu recepcionista IA funcionando."
      >
        <WelcomeWizard defaultBusinessType={defaultBusinessType} />
      </AuthCard>
    </AuthShell>
  )
}
