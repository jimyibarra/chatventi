import { LoginForm } from '@/features/auth/components/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">¡Bienvenido!</h1>
        <p className="mt-1 text-sm text-ink-muted">Entra al panel de tu negocio</p>
      </div>
      {error === 'confirmacion' && (
        <div className="rounded-lg border border-warn-bg bg-warn-bg p-3 text-sm text-warn">
          El enlace de confirmación ya se usó o expiró. Intenta entrar con tu correo y
          contraseña; si no puedes, regístrate de nuevo.
        </div>
      )}
      <LoginForm />
    </div>
  )
}
