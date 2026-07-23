'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signupSchema, type SignupInput } from '@/lib/validations/auth'
import { LEGAL } from '@/shared/constants/legal'
import { BUSINESS_TEMPLATES } from '@/features/agente-ia/business-templates'
import { PasswordInput } from './password-input'

const COUNTRIES = [
  'México',
  'Argentina',
  'Bolivia',
  'Brasil',
  'Chile',
  'Colombia',
  'Costa Rica',
  'Ecuador',
  'El Salvador',
  'España',
  'Estados Unidos',
  'Guatemala',
  'Honduras',
  'Nicaragua',
  'Panamá',
  'Paraguay',
  'Perú',
  'República Dominicana',
  'Uruguay',
  'Venezuela',
  'Otro',
]

const INPUT =
  'mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

// Los errores de Supabase a veces llegan sin message legible (se veía "{}"):
// siempre degradar a un texto útil.
function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo en un momento.'
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-center text-[13px] font-bold uppercase tracking-wide text-ink-soft">
      {children}
    </p>
  )
}

export function SignupForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { country: 'México', businessType: BUSINESS_TEMPLATES[0].key },
  })

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
          pending_business_type: values.businessType,
          pending_country: values.country,
          pending_city: values.city,
          pending_phone: values.phone,
          // Click-wrap: versión de Términos aceptada. El sello de tiempo legal
          // lo pone el servidor (now()) al crear el perfil vía RPC.
          pending_terms_version: LEGAL.termsVersion,
        },
      },
    })
    if (error) {
      setServerError(readableError(error))
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
      p_country: values.country,
      p_city: values.city,
      p_phone: values.phone,
      p_terms_version: LEGAL.termsVersion,
    })
    if (rpcError && !rpcError.message.includes('already_onboarded')) {
      setServerError('No se pudo crear el negocio: ' + readableError(rpcError))
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
      <SectionTitle>Sobre tu negocio</SectionTitle>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Empresa</label>
        <input
          type="text"
          placeholder="Nombre de tu negocio"
          {...register('orgName')}
          className={INPUT}
        />
        {errors.orgName && <p className="mt-1 text-sm text-red-600">{errors.orgName.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-muted">Tipo de negocio</label>
        <select {...register('businessType')} className={INPUT}>
          {BUSINESS_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-faint">
          Preparamos las instrucciones de tu recepcionista IA según tu giro (lo podrás editar).
        </p>
        {errors.businessType && (
          <p className="mt-1 text-sm text-red-600">{errors.businessType.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink-muted">País</label>
          <select {...register('country')} className={INPUT}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-muted">Ciudad</label>
          <input
            type="text"
            placeholder="Ciudad de tu negocio"
            {...register('city')}
            className={INPUT}
          />
          {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
        </div>
      </div>

      <SectionTitle>Sobre ti</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink-muted">Nombre</label>
          <input type="text" placeholder="Nombre" {...register('ownerName')} className={INPUT} />
          {errors.ownerName && (
            <p className="mt-1 text-sm text-red-600">{errors.ownerName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-muted">Teléfono</label>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="Teléfono"
            {...register('phone')}
            className={INPUT}
          />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
        </div>
      </div>
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
          placeholder="Tu contraseña"
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

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Creando…' : 'Registrarse'}
      </button>

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
