'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { recoverSchema, type RecoverInput } from '@/lib/validations/auth'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { FIELD_LABEL, FieldError, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { AuthCard } from './auth-card'
import { TurnstileWidget } from './turnstile-widget'

// Envía el correo de recuperación. El enlace aterriza en /auth/confirm?type=recovery
// que, tras verificar, redirige a /nueva-clave para fijar la contraseña.
export function RecoverForm() {
  const [sent, setSent] = useState(false)
  // Captcha (inerte sin NEXT_PUBLIC_TURNSTILE_SITE_KEY). GoTrue lo exige en el
  // flujo de recuperación cuando el captcha de Supabase Auth está activo.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverInput>({ resolver: zodResolver(recoverSchema) })

  async function onSubmit(values: RecoverInput) {
    const supabase = createClient()
    // No revelamos si el correo existe (anti-enumeración): siempre "enviado".
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      captchaToken: captchaToken ?? undefined,
    })
    setSent(true)
  }

  const back = (
    <ButtonLink href="/login" variant="ghost" className="w-full">
      <Icon name="arrowLeft" className="h-4 w-4" />
      Volver a iniciar sesión
    </ButtonLink>
  )

  if (sent) {
    return (
      <AuthCard title="Revisa tu correo">
        <Notice tone="success" icon="mail">
          Si el correo está registrado, te enviamos un enlace para definir una contraseña nueva. Puede
          tardar un par de minutos; revisa también spam.
        </Notice>
        <div className="mt-5 border-t border-line pt-4">{back}</div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un enlace para definir una contraseña nueva.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="recover-email" className={FIELD_LABEL}>
            Correo electrónico
          </label>
          <Input
            id="recover-email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'recover-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && <FieldError id="recover-email-error">{errors.email.message}</FieldError>}
        </div>
        <TurnstileWidget onToken={setCaptchaToken} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
        </Button>
        <div className="border-t border-line pt-4">{back}</div>
      </form>
    </AuthCard>
  )
}
