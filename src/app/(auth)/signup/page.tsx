import { SignupForm } from '@/features/auth/components/signup-form'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Crea tu negocio en ChatVenti</h1>
          <p className="mt-1 text-sm text-gray-600">Agenda + recepcionista IA en minutos</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
