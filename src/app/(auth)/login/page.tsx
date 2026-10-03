import type { Metadata } from 'next'
import { LoginForm } from '@/features/auth/components/login-form'
import { AuthCard } from '@/features/auth/components/auth-card'
import { Notice } from '@/shared/components/ui/notice'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthCard title="Te damos la bienvenida" subtitle="Entra al panel de tu negocio.">
      {error === 'confirmacion' && (
        <Notice tone="danger" size="sm" icon="link" className="mb-5">
          El enlace de confirmación ya se usó o expiró. Intenta entrar con tu correo y contraseña; si no
          puedes, regístrate de nuevo.
        </Notice>
      )}
      <LoginForm />
    </AuthCard>
  )
}
