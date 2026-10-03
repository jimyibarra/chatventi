'use client'

import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { CONTROL, CONTROL_H } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

// Input de contraseña con botón de "ojo" para alternar visibilidad. Lleva un
// botón dentro, así que su etiqueta va aparte con `htmlFor` → `id` (DESIGN.md:
// un <Field> envuelve UN control).
export function PasswordInput({
  id,
  registration,
  autoComplete,
  placeholder,
  readOnly,
  onFocus,
  errorId,
}: {
  id: string
  registration: UseFormRegisterReturn
  autoComplete: string
  placeholder?: string
  // "readonly hasta enfocar": evita que el navegador autorrellene credenciales
  // guardadas al cargar la página (p. ej. al volver al login tras salir).
  readOnly?: boolean
  onFocus?: () => void
  /** `id` del mensaje de error, si lo hay: marca el campo como inválido y lo enlaza. */
  errorId?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        {...registration}
        onFocus={onFocus}
        className={`${CONTROL} ${CONTROL_H} w-full pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[10px] text-ink-muted transition-colors duration-150 hover:bg-brand-50 hover:text-ink md:h-9 md:w-9"
      >
        <Icon name={show ? 'eyeOff' : 'eye'} className="h-5 w-5" />
      </button>
    </div>
  )
}
