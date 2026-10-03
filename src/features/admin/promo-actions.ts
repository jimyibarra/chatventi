'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { PROMO_TAG, clearTrialPromoCache, findTrialPromo } from '@/features/billing/promo'

export type PromoActionResult = { ok: true } | { ok: false; error: string }

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,30}$/, 'El código lleva de 3 a 30 letras, números o guiones, sin espacios.'),
  percent: z.coerce.number().int().min(1, 'El descuento va de 1 a 100 %.').max(100, 'El descuento va de 1 a 100 %.'),
  months: z.coerce.number().int().min(1, 'Los meses van de 1 a 24.').max(24, 'Los meses van de 1 a 24.'),
  active: z.boolean(),
})

/**
 * Guarda la promoción de fin de prueba EN STRIPE (la única fuente de verdad).
 * Mismo código, % y meses → solo se enciende o apaga. Si cambia algo de eso,
 * Stripe no deja editar un cupón: se apaga el código anterior y se crean un
 * cupón y un código nuevos (los clientes que ya lo usaron conservan el suyo).
 */
export async function saveTrialPromo(raw: unknown): Promise<PromoActionResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  const { code, percent, months, active } = parsed.data

  // Doble guarda: el layout /admin ya filtra por rol; aquí se repite porque una
  // Server Action se puede invocar directamente.
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'super_admin') return { ok: false, error: 'No autorizado.' }

  try {
    const stripe = getStripe()
    const current = await findTrialPromo()
    const same = current && current.code === code && current.percent === percent && current.months === months
    if (same) {
      if (current.active !== active) await stripe.promotionCodes.update(current.promoId, { active })
    } else {
      if (current?.active) await stripe.promotionCodes.update(current.promoId, { active: false })
      const coupon = await stripe.coupons.create({
        percent_off: percent,
        duration: 'repeating',
        duration_in_months: months,
        name: `ChatVenti ${code}`,
        metadata: { chatventi: PROMO_TAG },
      })
      await stripe.promotionCodes.create({
        promotion: { type: 'coupon', coupon: coupon.id },
        code,
        active,
        metadata: { chatventi: PROMO_TAG },
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[promo] Stripe', msg)
    if (/already exists|unique/i.test(msg)) return { ok: false, error: 'Ya hay otro código activo con ese nombre en Stripe. Usa otro.' }
    return { ok: false, error: 'Stripe no aceptó el cambio. Intenta de nuevo.' }
  }

  clearTrialPromoCache()
  revalidatePath('/admin/promocion')
  revalidatePath('/dashboard/facturacion')
  return { ok: true }
}
