'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { signupSchema, type SignupInput, PASSWORD_MIN } from '@/lib/validations/auth'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { CHECKBOX, FIELD_LABEL, FieldError, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { signUpAction } from '../signup-actions'
import { PasswordInput } from './password-input'
import { TurnstileWidget } from './turnstile-widget'

const LINK = 'rounded-[6px] font-semibold text-brand-600 underline-offset-4 hover:underline'

// Alta en DOS pasos. Aquí solo la CUENTA; los datos del negocio se piden en
// /bienvenida con el correo ya verificado. Antes había 9 campos por delante
// de cualquier señal de valor, y cada campo del registro cuesta conversión.
//
// No hay "confirmar contraseña" a propósito: el ojo permite ver lo escrito y
// existe recuperación en un clic. El checkbox de términos SÍ se queda: el
// registro legal depende de que la aceptación preceda a la cuenta.
export function SignupForm({ vertical, referral }: { vertical?: string; referral?: string }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  async function onSubmit(values: SignupInput) {
    setServerError(null)
    const result = await signUpAction({
      ...values,
      turnstileToken: turnstileToken ?? undefined,
      // Giro de la landing de procedencia. El servidor lo valida contra el
      // catálogo; aquí solo se transporta.
      vertical,
      ref: referral,
    })
    if (!result.ok) {
      setServerError(result.error)
      return
    }
    setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <Notice tone="success" icon="mail" title="Revisa tu correo">
        <p>
          Te enviamos un enlace para confirmar tu cuenta. Al abrirlo, configuramos tu negocio en menos
          de un minuto.
        </p>
        <p className="mt-1.5 text-[13.5px]">¿No lo ves? Mira en spam o promociones antes de volver a intentarlo.</p>
      </Notice>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="signup-email" className={FIELD_LABEL}>
          Correo electrónico
        </label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="hola@tunegocio.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          {...register('email')}
        />
        {errors.email && <FieldError id="signup-email-error">{errors.email.message}</FieldError>}
      </div>

      <div>
        <label htmlFor="signup-password" className={FIELD_LABEL}>
          Contraseña
        </label>
        <PasswordInput
          id="signup-password"
          registration={register('password')}
          autoComplete="new-password"
          placeholder={`Al menos ${PASSWORD_MIN} caracteres`}
          errorId={errors.password ? 'signup-password-error' : undefined}
        />
        {errors.password && <FieldError id="signup-password-error">{errors.password.message}</FieldError>}
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-snug text-ink-muted">
          <input
            type="checkbox"
            {...register('acceptTerms')}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? 'signup-terms-error' : undefined}
            className={`${CHECKBOX} mt-px`}
          />
          <span>
            He leído y acepto los{' '}
            <Link href="/terms" target="_blank" className={LINK}>
              Términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/privacy" target="_blank" className={LINK}>
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && <FieldError id="signup-terms-error">{errors.acceptTerms.message}</FieldError>}
      </div>

      {/* Se auto-oculta sin NEXT_PUBLIC_TURNSTILE_SITE_KEY. Con el captcha de
          Supabase Auth activo, el token viaja a signUp y GoTrue lo verifica. */}
      <TurnstileWidget onToken={setTurnstileToken} />

      {serverError && (
        <Notice tone="danger" size="sm">
          {serverError}
        </Notice>
      )}

      <div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creando…' : 'Crear mi cuenta gratis'}
        </Button>
        <p className="mt-2 text-center text-[13px] text-ink-muted">Prueba gratis. Sin tarjeta de crédito.</p>
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-center text-[14.5px] text-ink-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className={LINK}>
            Inicia sesión
          </Link>
        </p>
        <ButtonLink href="/" variant="ghost" className="w-full">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Regresar al inicio
        </ButtonLink>
      </div>
    </form>
  )
}
