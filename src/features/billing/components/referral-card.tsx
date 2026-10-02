'use client'

import { useState } from 'react'

/** "Recomienda y gana un mes": el enlace personal del negocio y lo que lleva ganado. */
export function ReferralCard({
  link,
  credited,
  pending,
}: {
  link: string
  /** Recompensas ya abonadas como saldo a favor. */
  credited: number
  /** Recomendados que ya pagaron, a la espera de que este negocio tenga plan activo. */
  pending: number
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Sin permiso de portapapeles: el enlace queda a la vista para copiarlo a mano.
    }
  }

  return (
    <section className="mt-6 rounded-card border border-brand-200 bg-brand-50 p-6" data-testid="referral-card">
      <h2 className="text-base font-semibold text-ink">Recomienda y gana un mes</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Comparte tu enlace con otro negocio. Cuando haga su primer pago, te abonamos un mes de tu
        plan: se descuenta solo de tu siguiente factura. Sin límite de recomendaciones.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Tu enlace para recomendar"
          className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      {(credited > 0 || pending > 0) && (
        <p className="mt-3 text-sm text-brand-900">
          {credited > 0 && (
            <>
              <strong>{credited}</strong> {credited === 1 ? 'mes ganado' : 'meses ganados'}
            </>
          )}
          {credited > 0 && pending > 0 && ' · '}
          {pending > 0 && (
            <>
              <strong>{pending}</strong> por abonar en cuanto actives tu plan
            </>
          )}
        </p>
      )}
    </section>
  )
}
