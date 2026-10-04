'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { Currency } from '@/features/billing/plans'
import { chooseCurrency } from '@/features/billing/currency-actions'

// Selector «Pesos / Dólares» de la página pública. La moneda inicial la pone el
// servidor por la ubicación de la visita; esto solo guarda otra elección.
export function CurrencySwitch({ currency, dark = false }: { currency: Currency; dark?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: Currency) {
    if (next === currency) return
    startTransition(async () => {
      await chooseCurrency(next)
      router.refresh()
    })
  }

  const base = 'rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors disabled:opacity-60'
  const on = dark ? 'bg-white text-[#1b1240]' : 'bg-[#1b1240] text-white'
  const off = dark ? 'text-white/80 hover:text-white' : 'text-[#5a5577] hover:text-[#1b1240]'
  return (
    <span
      role="group"
      aria-label="Moneda de los precios"
      className={`inline-flex gap-1 rounded-full p-1 ${dark ? 'bg-white/10' : 'bg-white shadow-[0_1px_0_#e4e2ef]'}`}
      data-testid="currency-switch"
    >
      {(['mxn', 'usd'] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={currency === c}
          disabled={pending}
          onClick={() => choose(c)}
          className={`${base} ${currency === c ? on : off}`}
        >
          {c === 'mxn' ? 'Pesos (MXN)' : 'Dólares (USD)'}
        </button>
      ))}
    </span>
  )
}
