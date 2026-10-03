'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { newPasswordSchema, type NewPasswordInput } from '@/lib/validations/auth'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { FIELD_LABEL, FieldError } from '@/shared/components/ui/field'
import { Notice } from '@/shared/components/ui/notice'
import { AuthCard } from './auth-card'
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
      <AuthCard title="Enlace no válido" subtitle="Este enlace ya se usó o expiró. Solicita uno nuevo y te lo enviamos a tu correo.">
        <ButtonLink href="/recuperar" className="w-full">
          Solicitar un enlace nuevo
        </ButtonLink>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Define tu contraseña" subtitle="Elige una contraseña para tu cuenta.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="new-password" className={FIELD_LABEL}>
            Nueva contraseña
          </label>
          <PasswordInput
            id="new-password"
            registration={register('password')}
            autoComplete="new-password"
            placeholder="Tu nueva contraseña"
            errorId={errors.password ? 'new-password-error' : undefined}
          />
          {errors.password && <FieldError id="new-password-error">{errors.password.message}</FieldError>}
        </div>
        <div>
          <label htmlFor="confirm-password" className={FIELD_LABEL}>
            Confirmar contraseña
          </label>
          <PasswordInput
            id="confirm-password"
            registration={register('confirmPassword')}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            errorId={errors.confirmPassword ? 'confirm-password-error' : undefined}
          />
          {errors.confirmPassword && (
            <FieldError id="confirm-password-error">{errors.confirmPassword.message}</FieldError>
          )}
        </div>
        {serverError && (
          <Notice tone="danger" size="sm">
            {serverError}
          </Notice>
        )}
        <Button type="submit" disabled={isSubmitting || ready === null} className="w-full">
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthCard>
  )
}
