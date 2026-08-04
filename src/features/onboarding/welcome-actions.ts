'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { LEGAL } from '@/shared/constants/legal'
import { getClientIp, getUserAgent } from '@/shared/security/request-context'

// Datos del NEGOCIO. Se piden aquí, no en el alta: pedirlos antes de que el
// usuario haya visto nada de valor cuesta conversión, y la cuenta ya está
// creada y verificada cuando se llega a este punto.
export const welcomeSchema = z.object({
  orgName: z.string().trim().min(2, 'Nombre del negocio requerido').max(80, 'Nombre demasiado largo'),
  businessType: z.string().min(1, 'Elige tu tipo de negocio'),
  country: z.string().min(2, 'País requerido'),
  city: z.string().trim().min(2, 'Ciudad requerida').max(60, 'Ciudad demasiado larga'),
  ownerName: z.string().trim().min(2, 'Tu nombre requerido').max(60, 'Nombre demasiado largo'),
  phone: z
    .string()
    .trim()
    .min(8, 'Teléfono de al menos 8 dígitos')
    .max(20, 'Teléfono demasiado largo')
    .regex(/^[+\d][\d\s-]+$/, 'Solo números, espacios o guiones'),
})

export type WelcomeInput = z.infer<typeof welcomeSchema>
export type WelcomeResult = { ok: true } | { ok: false; error: string }

/**
 * Crea la organización del usuario recién verificado.
 *
 * La versión de Términos sale de user_metadata (se guardó al registrarse,
 * ANTES de crear la cuenta) y el sello de tiempo lo pone la RPC con now().
 * Así el registro legal refleja cuándo se aceptó de verdad, no cuándo se
 * completó este formulario.
 */
export async function completeWelcome(raw: unknown): Promise<WelcomeResult> {
  const parsed = welcomeSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const values = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

  const meta = (user.user_metadata ?? {}) as {
    pending_terms_version?: string
    signup_ip?: string
    signup_user_agent?: string
  }

  // Si el alta es anterior a este flujo, no habrá metadatos: se usa la IP de
  // ahora como aproximación y la versión vigente de Términos.
  const requestHeaders = await headers()
  const ip = meta.signup_ip ?? getClientIp(requestHeaders)
  const userAgent = meta.signup_user_agent ?? getUserAgent(requestHeaders)

  const { error } = await supabase.rpc('create_organization_with_owner_v2', {
    p_org_name: values.orgName,
    p_owner_name: values.ownerName,
    p_business_type: values.businessType,
    p_country: values.country,
    p_city: values.city,
    p_phone: values.phone,
    p_terms_version: meta.pending_terms_version ?? LEGAL.termsVersion,
    p_signup_ip: ip,
    p_user_agent: userAgent ?? undefined,
  })

  if (error) {
    // Ya tenía negocio (doble envío, o dos pestañas): no es un fallo para el
    // usuario, ya está donde quería estar.
    if (error.message.includes('already_onboarded')) return { ok: true }
    return { ok: false, error: 'No pudimos crear tu negocio. Inténtalo de nuevo en un momento.' }
  }

  return { ok: true }
}
