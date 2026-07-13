'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { PasswordInput } from './password-input'

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
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
    })
    if (error) {
      setServerError('Correo o contraseña incorrectos.')
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink-muted">Correo</label>
        <input
          type="email"
          autoComplete="email"
          placeholder="hola@tunegocio.com"
          {...register('email')}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Contraseña</label>
        <PasswordInput
          registration={register('password')}
          autoComplete="current-password"
          placeholder="Tu contraseña"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>
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
