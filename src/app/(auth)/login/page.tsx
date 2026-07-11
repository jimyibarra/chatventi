import { LoginForm } from '@/features/auth/components/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">ChatVenti</h1>
          <p className="mt-1 text-sm text-gray-600">Entra a tu panel</p>
        </div>
        {error === 'confirmacion' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            El enlace de confirmación ya se usó o expiró. Intenta entrar con tu correo y
            contraseña; si no puedes, regístrate de nuevo.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
