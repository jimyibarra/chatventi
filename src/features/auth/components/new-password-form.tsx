'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { newPasswordSchema, type NewPasswordInput } from '@/lib/validations/auth'
import { PasswordInput } from './password-input'

// Fija una contraseña nueva. Requiere la sesión temporal que crea el enlace de
// recuperación (o de invitación) al aterrizar en /auth/confirm?type=recovery.
export function NewPasswordForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [ready, setReady] = useState<boolean | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) })

  // Sin sesión de recuperación no se puede actualizar la contraseña.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user)))
  }, [])

  async function onSubmit(values: NewPasswordInput) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      setServerError(error.message || 'No se pudo actualizar la contraseña.')
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  if (ready === false) {
    return (
      <div className="space-y-4 rounded-card border border-line bg-white p-8 shadow-sm">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Enlace no válido</h1>
        <p className="text-sm text-ink-muted">
          Este enlace ya se usó o expiró. Solicita uno nuevo desde{' '}
          <Link href="/recuperar" className="font-semibold text-brand-600 hover:underline">
            recuperar contraseña
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Define tu contraseña</h1>
        <p className="mt-1 text-sm text-ink-muted">Elige una contraseña para tu cuenta.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-muted">Nueva contraseña</label>
          <PasswordInput
            registration={register('password')}
            autoComplete="new-password"
            placeholder="Tu nueva contraseña"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-muted">Confirmar contraseña</label>
          <PasswordInput
            registration={register('confirmPassword')}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        <button
          type="submit"
          disabled={isSubmitting || ready === null}
          className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
