'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BUSINESS_TEMPLATES } from '@/features/agente-ia/business-templates'
import { Button } from '@/shared/components/ui/button'
import { FIELD_LABEL, FieldError, Input, Select } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { completeWelcome } from '../welcome-actions'
import { welcomeSchema, type WelcomeInput } from '../welcome-schema'

const COUNTRIES = [
  'México', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica',
  'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Guatemala', 'Honduras',
  'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'República Dominicana', 'Uruguay',
  'Venezuela', 'Otro',
]

const HINT = 'mt-1.5 block text-[13px] leading-snug text-ink-muted'

/**
 * Los dos pasos dibujados como un tramo de línea con dos estaciones (DESIGN.md):
 * la actual es el círculo doble, la hecha lleva palomita y la que falta va hueca.
 */
function Stations({ step }: { step: 1 | 2 }) {
  const station = (n: 1 | 2) => {
    if (n < step) {
      return (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-white" aria-hidden>
          <Icon name="check" className="h-4 w-4" strokeWidth={3} />
        </span>
      )
    }
    if (n === step) {
      return (
        <span
          className="h-7 w-7 rounded-full bg-brand-500 shadow-[inset_0_0_0_3px_#fff,0_0_0_3px_#5b4fe0]"
          aria-hidden
        />
      )
    }
    return <span className="h-7 w-7 rounded-full border-[3.5px] border-brand-500 bg-white" aria-hidden />
  }
  const label = (n: 1 | 2, text: string) => (
    <li className="flex items-center gap-2.5" aria-current={n === step ? 'step' : undefined}>
      {station(n)}
      <span className={`text-[14.5px] font-semibold ${n === step ? 'text-ink' : 'text-ink-muted'}`}>
        <span className="sr-only">{`Paso ${n} de 2: `}</span>
        {text}
      </span>
    </li>
  )
  return (
    <ol className="mb-6 flex items-center gap-3" aria-label="Pasos para configurar tu negocio">
      {label(1, 'Tu negocio')}
      <li aria-hidden className="h-1 min-w-6 flex-1 rounded-full bg-brand-500/25">
        <span
          className="block h-full origin-left rounded-full bg-brand-500 transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${step === 2 ? 1 : 0})` }}
        />
      </li>
      {label(2, 'Tú')}
    </ol>
  )
}

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

  // aria-invalid + aria-describedby de un campo con error.
  const describe = (name: keyof WelcomeInput) =>
    errors[name] ? { 'aria-invalid': true as const, 'aria-describedby': `welcome-${name}-error` } : {}

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stations step={step} />

      {/* El paso 1 se OCULTA, no se desmonta: desmontarlo perdería sus valores
          al volver atrás y react-hook-form dejaría de registrarlos. */}
      <div className={step === 1 ? 'space-y-4' : 'hidden'}>
        <div>
          <label htmlFor="welcome-orgName" className={FIELD_LABEL}>
            ¿Cómo se llama tu negocio?
          </label>
          <Input id="welcome-orgName" type="text" placeholder="Ej. Barbería El Rincón" {...describe('orgName')} {...register('orgName')} />
          {errors.orgName && <FieldError id="welcome-orgName-error">{errors.orgName.message}</FieldError>}
        </div>

        <div>
          <label htmlFor="welcome-businessType" className={FIELD_LABEL}>
            ¿A qué se dedica?
          </label>
          <Select id="welcome-businessType" aria-describedby="welcome-businessType-hint" {...register('businessType')}>
            {BUSINESS_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          <span id="welcome-businessType-hint" className={HINT}>
            Con esto dejamos tu recepcionista IA preparado para tu giro. Podrás cambiarlo cuando quieras.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="welcome-country" className={FIELD_LABEL}>
              País
            </label>
            <Select id="welcome-country" {...register('country')}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="welcome-city" className={FIELD_LABEL}>
              Ciudad
            </label>
            <Input id="welcome-city" type="text" placeholder="Tu ciudad" {...describe('city')} {...register('city')} />
            {errors.city && <FieldError id="welcome-city-error">{errors.city.message}</FieldError>}
          </div>
        </div>

        <Button onClick={goToStep2} className="w-full">
          Continuar
          <Icon name="arrowRight" className="h-4 w-4" />
        </Button>
      </div>

      <div className={step === 2 ? 'space-y-4' : 'hidden'}>
        <div>
          <label htmlFor="welcome-ownerName" className={FIELD_LABEL}>
            ¿Cómo te llamas?
          </label>
          <Input id="welcome-ownerName" type="text" autoComplete="name" placeholder="Tu nombre" {...describe('ownerName')} {...register('ownerName')} />
          {errors.ownerName && <FieldError id="welcome-ownerName-error">{errors.ownerName.message}</FieldError>}
        </div>

        <div>
          <label htmlFor="welcome-phone" className={FIELD_LABEL}>
            Teléfono de contacto
          </label>
          <Input
            id="welcome-phone"
            type="tel"
            autoComplete="tel"
            placeholder="55 1234 5678"
            {...describe('phone')}
            {...register('phone')}
          />
          {errors.phone ? (
            <FieldError id="welcome-phone-error">{errors.phone.message}</FieldError>
          ) : (
            <span className={HINT}>Lo usamos para avisarte de algo importante de tu cuenta. No se muestra a tus clientes.</span>
          )}
        </div>

        {serverError && (
          <Notice tone="danger" size="sm">
            {serverError}
          </Notice>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => setStep(1)}>
            <Icon name="arrowLeft" className="h-4 w-4" />
            Atrás
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? 'Creando tu negocio…' : 'Empezar'}
          </Button>
        </div>
      </div>
    </form>
  )
}
