import { SignupForm } from '@/features/auth/components/signup-form'

export default function SignupPage() {
  return (
    <div className="space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Crear cuenta</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tu agenda + recepcionista IA, lista en minutos
        </p>
      </div>
      <SignupForm />
    </div>
  )
}
