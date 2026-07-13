'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signupSchema, type SignupInput } from '@/lib/validations/auth'

export function SignupForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  async function onSubmit(values: SignupInput) {
    setServerError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // El enlace del correo aterriza en /auth/confirm, que canjea el token,
        // deja la sesion iniciada y manda a /dashboard (donde se crea el negocio).
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          full_name: values.ownerName,
          // Guardados como "pendientes": el onboarding se completa al primer
          // acceso autenticado (soporta confirmacion de correo activada).
          pending_org_name: values.orgName,
          pending_owner_name: values.ownerName,
        },
      },
    })
    if (error) {
      setServerError(error.message)
      return
    }
    // Si no hay sesion, la confirmacion de correo esta activa: avisar.
    if (!data.session) {
      setCheckEmail(true)
      return
    }
    // Sesion inmediata: crear el negocio ahora.
    const { error: rpcError } = await supabase.rpc('create_organization_with_owner', {
      p_org_name: values.orgName,
      p_owner_name: values.ownerName,
    })
    if (rpcError && !rpcError.message.includes('already_onboarded')) {
      setServerError('No se pudo crear el negocio: ' + rpcError.message)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <div className="rounded-lg border border-success-bg bg-success-bg p-4 text-sm text-success">
        Revisa tu correo para confirmar tu cuenta. Al iniciar sesión crearemos tu negocio
        automáticamente.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink-muted">Nombre del negocio</label>
        <input
          type="text"
          {...register('orgName')}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.orgName && <p className="mt-1 text-sm text-red-600">{errors.orgName.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Tu nombre</label>
        <input
          type="text"
          {...register('ownerName')}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.ownerName && <p className="mt-1 text-sm text-red-600">{errors.ownerName.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Correo</label>
        <input
          type="email"
          autoComplete="email"
          {...register('email')}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Creando…' : 'Crear mi negocio'}
      </button>
      <p className="text-center text-sm text-ink-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
