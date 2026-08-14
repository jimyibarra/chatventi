'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
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
      setServerError('Correo o contraseña incorrectos.')
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
        <label className="block text-sm font-medium text-ink-muted">Correo</label>
        <input
          type="email"
          autoComplete="off"
          readOnly={locked}
          placeholder="hola@tunegocio.com"
          {...register('email')}
          onFocus={unlock}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Contraseña</label>
        <PasswordInput
          registration={register('password')}
          autoComplete="off"
          placeholder="Tu contraseña"
          readOnly={locked}
          onFocus={unlock}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        <div className="mt-1 text-right">
          <Link href="/recuperar" className="text-sm font-medium text-brand-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
      <TurnstileWidget key={captchaNonce} onToken={setCaptchaToken} />

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <p className="text-center text-sm text-ink-muted">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Registrarse
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
