import { LoginForm } from '@/features/auth/components/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-card bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">ChatVenti</h1>
          <p className="mt-1 text-sm text-ink-muted">Entra a tu panel</p>
        </div>
        {error === 'confirmacion' && (
          <div className="rounded-lg border border-warn-bg bg-warn-bg p-3 text-sm text-warn">
            El enlace de confirmación ya se usó o expiró. Intenta entrar con tu correo y
            contraseña; si no puedes, regístrate de nuevo.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
