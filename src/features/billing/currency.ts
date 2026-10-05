import 'server-only'
import { cookies, headers } from 'next/headers'
import { CURRENCY_COOKIE, isMexico, type Currency } from './plans'

// Moneda en que se le muestran los precios a alguien (decisión de Juan, 2026-10-04):
//   · Página pública → ubicación de la visita (Vercel manda el país en
//     `x-vercel-ip-country`), con un selector que guarda la elección en una cookie.
//   · Facturación y pago → país del negocio registrado. La ubicación falla con
//     VPN o si el dueño está de viaje; el país del negocio, no.
//   · Quien ya paga sigue en la moneda de su suscripción: Stripe no deja cambiar
//     la moneda de un cliente que ya tiene facturas.

function asCurrency(v: string | null | undefined): Currency | null {
  return v === 'mxn' || v === 'usd' ? v : null
}

/** Moneda para la página pública: la elegida en el selector o la de la ubicación. */
export async function visitorCurrency(): Promise<Currency> {
  const chosen = asCurrency((await cookies()).get(CURRENCY_COOKIE)?.value)
  if (chosen) return chosen
  return (await headers()).get('x-vercel-ip-country') === 'MX' ? 'mxn' : 'usd'
}

/**
 * Moneda de cobro de un negocio. Manda la de su suscripción si ya paga; si no,
 * su país registrado; y si el negocio es antiguo y no lo tiene, la ubicación.
 */
export async function billingCurrency(opts: {
  country: string | null | undefined
  subscriptionCurrency?: string | null
}): Promise<Currency> {
  const paying = asCurrency(opts.subscriptionCurrency)
  if (paying) return paying
  if (opts.country) return isMexico(opts.country) ? 'mxn' : 'usd'
  return (await headers()).get('x-vercel-ip-country') === 'MX' ? 'mxn' : 'usd'
}
