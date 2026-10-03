'use client'

import { useState } from 'react'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

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
    <Section
      className="mt-4"
      data-testid="referral-card"
      title={
        <>
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-500 text-white" aria-hidden>
            <Icon name="gift" className="h-[18px] w-[18px]" />
          </span>
          Recomienda y gana un mes
        </>
      }
      description="Comparte tu enlace con otro negocio. Cuando haga su primer pago, te abonamos un mes de tu plan: se descuenta solo de tu siguiente factura. Sin límite de recomendaciones."
    >
      <div className="flex gap-2">
        <Input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Tu enlace para recomendar"
          className="min-w-0 flex-1"
        />
        <Button onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? '¡Copiado!' : 'Copiar'}
        </Button>
      </div>
      {(credited > 0 || pending > 0) && (
        <p className="mt-3 text-[14.5px] text-ink">
          {credited > 0 && (
            <>
              <strong className="tabular-nums">{credited}</strong> {credited === 1 ? 'mes ganado' : 'meses ganados'}
            </>
          )}
          {credited > 0 && pending > 0 && ' · '}
          {pending > 0 && (
            <>
              <strong className="tabular-nums">{pending}</strong> por abonar en cuanto actives tu plan
            </>
          )}
        </p>
      )}
    </Section>
  )
}
