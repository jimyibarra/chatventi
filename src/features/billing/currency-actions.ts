'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

/** Guarda la moneda que eligió la visita en el selector «Pesos / Dólares». */
export async function chooseCurrency(raw: unknown): Promise<void> {
  const parsed = z.enum(['mxn', 'usd']).safeParse(raw)
  if (!parsed.success) return
  ;(await cookies()).set('cv_moneda', parsed.data, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}
