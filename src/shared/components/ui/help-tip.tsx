'use client'

import { useId, useState, type ReactNode } from 'react'

/**
 * «?» junto a la etiqueta de un campo. Al tocarlo despliega la ayuda DEBAJO,
 * en línea: nada flotante que se salga de la pantalla en el celular. Va dentro
 * de <Field label>, así que todo es <span> (un <label> no admite bloques) y el
 * clic no enfoca el campo.
 */
export function HelpTip({ topic, children }: { topic: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Ayuda: ${topic}`}
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        className="relative ml-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-brand-100 align-[-4px] text-[12px] font-bold text-brand-800 transition-colors duration-150 before:absolute before:-inset-3 before:content-[''] hover:bg-brand-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 aria-expanded:bg-brand-500 aria-expanded:text-white"
        data-testid="help-tip"
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="mt-2 block space-y-1.5 rounded-[12px] bg-brand-50 px-3 py-2.5 text-[13.5px] font-normal leading-snug text-brand-900">
          {children}
        </span>
      )}
    </>
  )
}

/** Un paso numerado dentro de un HelpTip (span en bloque: válido dentro de <label>). */
export function HelpStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="flex gap-2">
      <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-white text-[11.5px] font-bold text-brand-800">{n}</span>
      <span className="min-w-0">{children}</span>
    </span>
  )
}
