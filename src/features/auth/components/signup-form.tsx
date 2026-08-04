'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { signupSchema, type SignupInput, PASSWORD_MIN } from '@/lib/validations/auth'
import { signUpAction } from '../signup-actions'
import { PasswordInput } from './password-input'
import { TurnstileWidget } from './turnstile-widget'

const INPUT =
  'mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

// Alta en DOS pasos. Aquí solo la CUENTA; los datos del negocio se piden en
// /bienvenida con el correo ya verificado. Antes había 9 campos por delante
// de cualquier señal de valor, y cada campo del registro cuesta conversión.
//
// No hay "confirmar contraseña" a propósito: el ojo permite ver lo escrito y
// existe recuperación en un clic. El checkbox de términos SÍ se queda: el
// registro legal depende de que la aceptación preceda a la cuenta.
export function SignupForm() {
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
    const result = await signUpAction({ ...values, turnstileToken: turnstileToken ?? undefined })
    if (!result.ok) {
      setServerError(result.error)
      return
    }
    setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <div className="space-y-3 rounded-lg border border-success-bg bg-success-bg p-5 text-sm text-success">
        <p className="text-base font-semibold">Revisa tu correo</p>
        <p>
          Te enviamos un enlace para confirmar tu cuenta. Al abrirlo, configuramos tu negocio en
          menos de un minuto.
        </p>
        <p className="text-xs opacity-80">
          ¿No lo ves? Mira en spam o promociones antes de volver a intentarlo.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink-muted">Correo electrónico</label>
        <input
          type="email"
          autoComplete="email"
          placeholder="hola@tunegocio.com"
          {...register('email')}
          className={INPUT}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted">Contraseña</label>
        <PasswordInput
          registration={register('password')}
          autoComplete="new-password"
          placeholder={`Al menos ${PASSWORD_MIN} caracteres`}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      <div>
        <label className="flex items-start gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            {...register('acceptTerms')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-500 focus:ring-brand-400"
          />
          <span>
            He leído y acepto los{' '}
            <Link
              href="/terms"
              target="_blank"
              className="font-semibold text-brand-600 hover:underline"
            >
              Términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link
              href="/privacy"
              target="_blank"
              className="font-semibold text-brand-600 hover:underline"
            >
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="mt-1 text-sm text-red-600">{errors.acceptTerms.message}</p>
        )}
      </div>

      <TurnstileWidget onToken={setTurnstileToken} />

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Creando…' : 'Crear mi cuenta gratis'}
      </button>

      <p className="text-center text-xs text-ink-faint">
        Prueba gratis. Sin tarjeta de crédito.
      </p>

      <p className="text-center text-sm text-ink-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Iniciar sesión
        </Link>
      </p>
      <Link
        href="/"
        className="block w-full rounded-lg border border-line bg-surface px-4 py-2 text-center text-sm font-medium text-ink-muted transition-colors hover:bg-line-soft"
      >
        ← Regresar
      </Link>
    </form>
  )
}
