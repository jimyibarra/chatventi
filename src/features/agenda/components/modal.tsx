'use client'

import { useEffect, useId } from 'react'

// Diálogo «Líneas»: hoja inferior en celular (el pulgar llega a los botones),
// tarjeta centrada en computadora.
export function Modal({
  title,
  onClose,
  children,
  testId,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  testId?: string
}) {
  const titleId = useId()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_40px_-12px_rgba(42,26,94,.4)] sm:rounded-[22px] sm:p-6 sm:shadow-[0_24px_60px_-20px_rgba(42,26,94,.5)]"
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Asa de la hoja inferior (solo celular). */}
        <i className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-[1.25rem] font-bold leading-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 flex-none place-items-center rounded-[12px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
