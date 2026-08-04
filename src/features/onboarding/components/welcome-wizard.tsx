'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BUSINESS_TEMPLATES } from '@/features/agente-ia/business-templates'
import { completeWelcome } from '../welcome-actions'
import { welcomeSchema, type WelcomeInput } from '../welcome-schema'

const COUNTRIES = [
  'México', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica',
  'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Guatemala', 'Honduras',
  'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'República Dominicana', 'Uruguay',
  'Venezuela', 'Otro',
]

const INPUT =
  'mt-1 w-full rounded-lg border border-line px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

// Asistente de bienvenida en 2 pasos. Se llega aquí con el correo YA
// verificado; el gate del proxy manda a esta ruta a toda cuenta sin negocio.
// `defaultBusinessType` llega del giro de la landing por la que entró el
// usuario (/para/<giro>). El servidor ya lo validó contra las plantillas.
export function WelcomeWizard({ defaultBusinessType }: { defaultBusinessType?: string }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<WelcomeInput>({
    resolver: zodResolver(welcomeSchema),
    defaultValues: {
      country: 'México',
      businessType: defaultBusinessType ?? BUSINESS_TEMPLATES[0].key,
    },
    mode: 'onTouched',
  })

  async function goToStep2() {
    // Solo valida los campos del paso 1: si no, los errores del paso 2
    // aparecerían antes de que el usuario haya podido escribir nada.
    const ok = await trigger(['orgName', 'businessType', 'country', 'city'])
    if (ok) setStep(2)
  }

  async function onSubmit(values: WelcomeInput) {
    setServerError(null)
    const result = await completeWelcome(values)
    if (!result.ok) {
      setServerError(result.error)
      return
    }
    // Navegación DURA, no router.push: el gate del proxy debe releer el
    // estado (ya hay perfil) y el árbol de servidor tiene que reconstruirse
    // con la organización recién creada.
    window.location.assign('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <ol className="flex items-center gap-2 text-xs font-medium">
        <li className={step === 1 ? 'text-brand-600' : 'text-ink-faint'}>1 · Tu negocio</li>
        <li className="text-ink-faint">—</li>
        <li className={step === 2 ? 'text-brand-600' : 'text-ink-faint'}>2 · Tú</li>
      </ol>

      {/* El paso 1 se OCULTA, no se desmonta: desmontarlo perdería sus valores
          al volver atrás y react-hook-form dejaría de registrarlos. */}
      <div className={step === 1 ? 'space-y-4' : 'hidden'}>
        <div>
          <label className="block text-sm font-medium text-ink-muted">
            ¿Cómo se llama tu negocio?
          </label>
          <input
            type="text"
            placeholder="Ej. Barbería El Rincón"
            {...register('orgName')}
            className={INPUT}
          />
          {errors.orgName && <p className="mt-1 text-sm text-red-600">{errors.orgName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-muted">¿A qué se dedica?</label>
          <select {...register('businessType')} className={INPUT}>
            {BUSINESS_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-faint">
            Con esto dejamos tu recepcionista IA preparado para tu giro. Podrás cambiarlo cuando
            quieras.
          </p>
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
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted">Ciudad</label>
            <input type="text" placeholder="Tu ciudad" {...register('city')} className={INPUT} />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={goToStep2}
          className="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600"
        >
          Continuar
        </button>
      </div>

      <div className={step === 2 ? 'space-y-4' : 'hidden'}>
        <div>
          <label className="block text-sm font-medium text-ink-muted">¿Cómo te llamas?</label>
          <input
            type="text"
            placeholder="Tu nombre"
            {...register('ownerName')}
            className={INPUT}
          />
          {errors.ownerName && (
            <p className="mt-1 text-sm text-red-600">{errors.ownerName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-muted">Teléfono de contacto</label>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="55 1234 5678"
            {...register('phone')}
            className={INPUT}
          />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
          <p className="mt-1 text-xs text-ink-faint">
            Lo usamos para avisarte de algo importante de tu cuenta. No se muestra a tus clientes.
          </p>
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-line-soft"
          >
            ← Atrás
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Creando tu negocio…' : 'Empezar'}
          </button>
        </div>
      </div>
    </form>
  )
}
