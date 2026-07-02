import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">ChatVenti</h1>
          <p className="mt-1 text-sm text-gray-600">Entra a tu panel</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
