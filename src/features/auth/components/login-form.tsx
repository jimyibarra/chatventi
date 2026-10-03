'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { FIELD_LABEL, FieldError, Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { PasswordInput } from './password-input'
import { TurnstileWidget } from './turnstile-widget'

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  // Captcha (Turnstile). Solo se pinta si hay NEXT_PUBLIC_TURNSTILE_SITE_KEY; si
  // no, el widget no renderiza y captchaToken queda null -> se comporta como
  // hoy. Cuando el captcha de Supabase Auth está activo, GoTrue exige este token.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // El token de Turnstile es de un solo uso: tras un intento fallido hay que
  // pedir uno nuevo. Cambiar la key re-monta el widget y emite otro token.
  const [captchaNonce, setCaptchaNonce] = useState(0)
  // Campos "bloqueados" hasta que el usuario los enfoca: así el navegador NO
  // autorrellena las credenciales guardadas al aterrizar (privacidad en equipos
  // compartidos; los campos quedan vacíos al salir de sesión).
  const [locked, setLocked] = useState(true)
  const unlock = () => setLocked(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
      options: { captchaToken: captchaToken ?? undefined },
    })
    if (error) {
      // Un fallo del captcha se distingue de credenciales malas: si no, un
      // captcha mal configurado parecía "contraseña incorrecta" y no había
      // forma de saber cuál era el problema.
      setServerError(
        error.code === 'captcha_failed' || /captcha/i.test(error.message)
          ? 'No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.'
          : 'Correo o contraseña incorrectos.'
      )
      // Rehacer el reto para el siguiente intento (token de un solo uso).
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      <div>
        <label htmlFor="login-email" className={FIELD_LABEL}>
          Correo
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="off"
          readOnly={locked}
          placeholder="hola@tunegocio.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
          onFocus={unlock}
        />
        {errors.email && <FieldError id="login-email-error">{errors.email.message}</FieldError>}
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <label htmlFor="login-password" className="text-[13.5px] font-semibold text-ink">
            Contraseña
          </label>
          <Link
            href="/recuperar"
            className="rounded-[6px] text-[13.5px] font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          registration={register('password')}
          autoComplete="off"
          placeholder="Tu contraseña"
          readOnly={locked}
          onFocus={unlock}
          errorId={errors.password ? 'login-password-error' : undefined}
        />
        {errors.password && <FieldError id="login-password-error">{errors.password.message}</FieldError>}
      </div>
      <TurnstileWidget key={captchaNonce} onToken={setCaptchaToken} />

      {serverError && (
        <Notice tone="danger" size="sm">
          {serverError}
        </Notice>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </Button>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-center text-[14.5px] text-ink-muted">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="rounded-[6px] font-semibold text-brand-600 underline-offset-4 hover:underline">
            Regístrate
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
