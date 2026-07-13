'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { recoverSchema, type RecoverInput } from '@/lib/validations/auth'

// Envía el correo de recuperación. El enlace aterriza en /auth/confirm?type=recovery
// que, tras verificar, redirige a /nueva-clave para fijar la contraseña.
export function RecoverForm() {
  const [sent, setSent] = useState(false)
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
    })
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-4 rounded-card border border-line bg-white p-8 shadow-sm">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Revisa tu correo</h1>
        <p className="text-sm text-ink-muted">
          Si el correo está registrado, te enviamos un enlace para definir una contraseña
          nueva. Puede tardar un par de minutos; revisa también spam.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-brand-600 hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Te enviaremos un enlace para definir una contraseña nueva.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-muted">Correo electrónico</label>
          <input
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            {...register('email')}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
        </button>
        <p className="text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
