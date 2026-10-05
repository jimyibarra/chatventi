'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ANNUAL_MONTHS_CHARGED,
  ANNUAL_MONTHS_FREE,
  CURRENCY_COOKIE,
  currencyCode,
  fmtAmount,
  type Currency,
} from '@/features/billing/plans'
import { Check } from './check'

export type Fare = {
  id: string
  name: string
  who: string
  usd: number
  mxn: number
  items: string[]
  /** Color de su línea (el plan popular va en tinta, sin línea). */
  color: string
  popular: boolean
}

// Tarifa de la home: mensual/anual y pesos/dólares cambian aquí mismo, sin
// recargar. La moneda inicial la decide el servidor por la ubicación de la
// visita; la elección se guarda en la misma cookie que lee `visitorCurrency`.
export function Fares({
  fares,
  initial,
  trialDays,
  signupHref = '/signup',
  title = 'Cuatro planes. La recepcionista va en todos.',
}: {
  fares: Fare[]
  initial: Currency
  trialDays: number
  signupHref?: string
  title?: string
}) {
  const [cur, setCur] = useState<Currency>(initial)
  const [year, setYear] = useState(false)
  // El precio solo «rueda» tras un cambio, nunca al cargar.
  const [rolled, setRolled] = useState(false)
  const mxn = cur === 'mxn'

  function chooseCurrency(next: Currency) {
    setCur(next)
    setRolled(true)
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }
  function chooseYear(next: boolean) {
    setYear(next)
    setRolled(true)
  }

  return (
    <>
      <div className="s-head">
        <h2 id="precios-t">{title}</h2>
        <p>
          Elige por el tamaño de tu equipo. Empiezas con {trialDays} días gratis y sin tarjeta.{' '}
          {mxn ? 'Precios en pesos mexicanos, más IVA.' : 'Precios en dólares (USD).'}
        </p>
      </div>
      <div className="cur">
        <div className="toggle" role="group" aria-label="Forma de pago">
          <button type="button" aria-pressed={!year} onClick={() => chooseYear(false)}>Mensual</button>
          <button type="button" aria-pressed={year} onClick={() => chooseYear(true)}>
            Anual <em>{ANNUAL_MONTHS_FREE} meses gratis</em>
          </button>
        </div>
        <div className="toggle" role="group" aria-label="Moneda" data-testid="currency-switch">
          <button type="button" aria-pressed={mxn} onClick={() => chooseCurrency('mxn')}>Pesos (MXN)</button>
          <button type="button" aria-pressed={!mxn} onClick={() => chooseCurrency('usd')}>Dólares (USD)</button>
        </div>
      </div>
      <div className="fares">
        {fares.map((f) => {
          const amount = (mxn ? f.mxn : f.usd) * (year ? ANNUAL_MONTHS_CHARGED : 1)
          const text = fmtAmount(amount)
          return (
            <article key={f.id} className={f.popular ? 'fare pop' : 'fare'}>
              {f.popular ? <span className="badge">El más elegido</span> : <span className="line" style={{ background: f.color }} />}
              <h3>{f.name}</h3>
              <p className="who">{f.who}</p>
              <p className="price num">
                <span key={text} className={rolled ? 'v roll' : 'v'}>{text}</span>{' '}
                <small>{currencyCode(cur)}/{year ? 'año' : 'mes'}</small>
              </p>
              <p className="per num">
                {mxn ? 'Más IVA. ' : ''}
                {year ? `Pagas ${ANNUAL_MONTHS_CHARGED} meses y usas 12.` : ''}
              </p>
              <ul>
                {f.items.map((it) => <li key={it}><Check />{it}</li>)}
              </ul>
              <Link className={f.popular ? 'btn btn-amber' : 'btn btn-ghost'} href={signupHref}>
                {f.popular ? `Probar gratis ${trialDays} días` : 'Probar gratis'}
              </Link>
            </article>
          )
        })}
      </div>
    </>
  )
}
