'use client'

import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

// Input de contraseña con botón de "ojo" para alternar visibilidad.
export function PasswordInput({
  registration,
  autoComplete,
  placeholder,
  readOnly,
  onFocus,
}: {
  registration: UseFormRegisterReturn
  autoComplete: string
  placeholder?: string
  // "readonly hasta enfocar": evita que el navegador autorrellene credenciales
  // guardadas al cargar la página (p. ej. al volver al login tras salir).
  readOnly?: boolean
  onFocus?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative mt-1">
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        readOnly={readOnly}
        {...registration}
        onFocus={onFocus}
        className="w-full rounded-lg border border-line px-3 py-2 pr-11 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint transition-colors hover:text-ink-muted"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M3 3l18 18M10.6 10.7a2.8 2.8 0 0 0 3.9 4M6.6 6.7C4.2 8.1 2.6 10.2 2 12c1.5 4 5.5 7 10 7 1.7 0 3.3-.4 4.7-1.1M12 5c4.5 0 8.5 3 10 7-.4 1.1-1.1 2.2-2 3.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M2 12c1.5-4 5.5-7 10-7s8.5 3 10 7c-1.5 4-5.5 7-10 7S3.5 16 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
