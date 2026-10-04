import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { EXTRA_REPLY_PRICE_USD, planById, usageOverage, type PlanId } from '@/features/billing/plans'

// =====================================================================
// API de socios (revendedores). PASEN es el primero.
//
//   Un socio se identifica con una clave `cvp_…` en `Authorization: Bearer`.
//   En la base solo vive la huella SHA-256 de la clave. Todo lo que hace un
//   socio queda acotado a SUS negocios (`organizations.partner_id`): cada
//   consulta filtra por el id del socio autenticado, nunca por un id que
//   venga en la petición.
// =====================================================================

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')
const PLAN_IDS = ['arranque', 'negocio', 'profesional', 'multisede'] as const

export type Partner = {
  id: string
  name: string
  discount_pct: number
}

type Service = ReturnType<typeof createServiceClient>

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
export const apiError = (code: string, status: number, message?: string) =>
  json({ error: code, ...(message ? { message } : {}) }, status)

/** Valida la clave del socio. Devuelve el socio o la respuesta de error ya armada. */
export async function authenticatePartner(
  request: NextRequest
): Promise<{ partner: Partner; service: Service } | NextResponse> {
  const header = request.headers.get('authorization') ?? ''
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!/^cvp_[a-f0-9]{48}$/.test(key)) return apiError('unauthorized', 401)

  const service = createServiceClient()
  const { data: partner } = await service
    .from('partners')
    .select('id, name, discount_pct, status')
    .eq('api_key_hash', createHash('sha256').update(key).digest('hex'))
    .maybeSingle()
  if (!partner) return apiError('unauthorized', 401)
  if (partner.status !== 'active') return apiError('partner_suspended', 403)

  const allowed = await consumeRateLimit({
    bucket: 'partner_api',
    key: partner.id,
    limit: 600,
    windowSeconds: 60 * 60,
  })
  if (!allowed) return apiError('rate_limited', 429)

  return { partner: { id: partner.id, name: partner.name, discount_pct: Number(partner.discount_pct) }, service }
}

// ---------------------------------------------------------------------
// Alta de un negocio
// ---------------------------------------------------------------------

export const createOrgSchema = z.object({
  /** Id del negocio en el sistema del socio. Repetir el alta con el mismo id devuelve el mismo negocio. */
  externalId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(80),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerName: z.string().trim().max(60).optional(),
  plan: z.enum(PLAN_IDS).default('arranque'),
  businessType: z.string().trim().max(40).optional(),
  country: z.string().trim().length(2).optional(),
  city: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(20).optional(),
})

function slugFor(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return `${base || 'negocio'}-${randomBytes(2).toString('hex')}`
}

function describeOrg(org: { id: string; name: string; web_slug: string | null; partner_ref: string | null }, sub: { status: string; plan_id: string | null } | null) {
  return {
    id: org.id,
    externalId: org.partner_ref,
    name: org.name,
    plan: sub?.plan_id ?? null,
    status: sub?.status === 'active' ? 'active' : 'suspended',
    bookingUrl: org.web_slug ? `${SITE}/r/${org.web_slug}` : null,
    dashboardUrl: `${SITE}/dashboard`,
  }
}

async function loadOrg(service: Service, partnerId: string, filter: { id?: string; ref?: string }) {
  let q = service
    .from('organizations')
    .select('id, name, web_slug, partner_ref, created_at')
    .eq('partner_id', partnerId)
  q = filter.id ? q.eq('id', filter.id) : q.eq('partner_ref', filter.ref ?? '')
  const { data: org } = await q.maybeSingle()
  if (!org) return null
  const { data: sub } = await service
    .from('subscriptions')
    .select('status, plan_id')
    .eq('organization_id', org.id)
    .maybeSingle()
  return { org, sub }
}

export async function createPartnerOrganization(
  service: Service,
  partner: Partner,
  input: z.infer<typeof createOrgSchema>
): Promise<NextResponse> {
  // Idempotente por (socio, externalId): un reintento no crea un segundo negocio.
  const existing = await loadOrg(service, partner.id, { ref: input.externalId })
  if (existing) return json({ ...describeOrg(existing.org, existing.sub), created: false })

  // El dueño es una cuenta NUEVA. Si el correo ya tiene cuenta en ChatVenti
  // no se le adjunta nada: hacerlo dejaría que un socio "reclamara" la cuenta
  // de otra persona con solo conocer su correo.
  const { data: created, error: userErr } = await service.auth.admin.createUser({
    email: input.ownerEmail,
    email_confirm: true,
    password: `${randomBytes(18).toString('base64url')}aA1!`,
    user_metadata: { created_by_partner: partner.id },
  })
  if (userErr || !created?.user) {
    return apiError('owner_email_in_use', 409, 'Ese correo ya tiene una cuenta en ChatVenti. Usa otro correo para el dueño.')
  }
  const userId = created.user.id

  let orgId: string | null = null
  let lastError = ''
  for (let attempt = 0; attempt < 3 && !orgId; attempt++) {
    const { data, error } = await service.rpc('partner_create_organization', {
      p_partner: partner.id,
      p_user: userId,
      p_partner_ref: input.externalId,
      p_org_name: input.name,
      p_plan: input.plan,
      p_web_slug: slugFor(input.name),
      p_owner_name: input.ownerName,
      p_business_type: input.businessType,
      p_country: input.country?.toUpperCase(),
      p_city: input.city,
      p_phone: input.phone,
    })
    if (!error) orgId = data as string
    else {
      lastError = error.message
      // Solo se reintenta el choque de slug; cualquier otro error es definitivo.
      if (!lastError.includes('organizations_web_slug_key')) break
    }
  }
  if (!orgId) {
    // Sin negocio, la cuenta recién creada quedaría huérfana: se retira.
    await service.auth.admin.deleteUser(userId).catch(() => null)
    console.error('[socios] alta fallida', lastError)
    // Dos altas simultáneas con el mismo externalId: gana una; la otra lee su resultado.
    const raced = await loadOrg(service, partner.id, { ref: input.externalId })
    if (raced) return json({ ...describeOrg(raced.org, raced.sub), created: false })
    return apiError('create_failed', 500)
  }

  // Enlace de un solo uso para que el dueño elija su contraseña.
  const { data: link } = await service.auth.admin.generateLink({ type: 'recovery', email: input.ownerEmail })
  const hashed = link?.properties?.hashed_token
  const fresh = await loadOrg(service, partner.id, { id: orgId })
  if (!fresh) return apiError('create_failed', 500)
  return json(
    {
      ...describeOrg(fresh.org, fresh.sub),
      created: true,
      setPasswordUrl: hashed ? `${SITE}/auth/confirm?token_hash=${hashed}&type=recovery` : null,
    },
    201
  )
}

// ---------------------------------------------------------------------
// Consulta, listado y cambios
// ---------------------------------------------------------------------

export async function listPartnerOrganizations(service: Service, partner: Partner): Promise<NextResponse> {
  const { data: orgs } = await service
    .from('organizations')
    .select('id, name, web_slug, partner_ref')
    .eq('partner_id', partner.id)
    .order('created_at')
    .limit(1000)
  const ids = (orgs ?? []).map((o) => o.id)
  const { data: subs } = ids.length
    ? await service.from('subscriptions').select('organization_id, status, plan_id').in('organization_id', ids)
    : { data: [] }
  const byOrg = new Map((subs ?? []).map((s) => [s.organization_id, s]))
  return json({ organizations: (orgs ?? []).map((o) => describeOrg(o, byOrg.get(o.id) ?? null)) })
}

/** Precio mensual que se le factura al socio por un negocio en ese plan. */
export function partnerPlanPriceUsd(partner: Pick<Partner, 'discount_pct'>, planId: PlanId): number {
  return Number((planById(planId).priceUsd * (1 - partner.discount_pct / 100)).toFixed(2))
}

export async function getPartnerOrganization(
  service: Service,
  partner: Partner,
  orgId: string,
  period: string | null
): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(orgId).success) return apiError('not_found', 404)
  const month = period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : new Date().toISOString().slice(0, 7)
  const found = await loadOrg(service, partner.id, { id: orgId })
  if (!found) return apiError('not_found', 404)

  const from = `${month}-01T00:00:00Z`
  const next = new Date(from)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const to = next.toISOString()

  const [{ data: usageRow }, appts, convs] = await Promise.all([
    service
      .from('usage_periods')
      .select('ai_replies, status')
      .eq('organization_id', orgId)
      .eq('period_start', `${month}-01`)
      .maybeSingle(),
    service
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', from)
      .lt('created_at', to),
    service
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('last_message_at', from)
      .lt('last_message_at', to),
  ])

  const planId = (found.sub?.plan_id ?? 'arranque') as PlanId
  const aiReplies = usageRow?.ai_replies ?? 0
  const over = usageOverage(planId, aiReplies)
  return json({
    ...describeOrg(found.org, found.sub),
    period: month,
    usage: {
      aiReplies,
      includedReplies: over.included,
      extraReplies: over.extra,
      extraReplyPriceUsd: Number(EXTRA_REPLY_PRICE_USD.toFixed(5)),
      overageUsd: over.charge,
      closed: usageRow ? usageRow.status !== 'open' : false,
    },
    activity: { appointmentsCreated: appts.count ?? 0, conversationsActive: convs.count ?? 0 },
    billing: { planPriceUsd: partnerPlanPriceUsd(partner, planId), currency: 'usd' },
  })
}

export const updateOrgSchema = z
  .object({
    status: z.enum(['active', 'suspended']).optional(),
    plan: z.enum(PLAN_IDS).optional(),
  })
  .refine((v) => v.status || v.plan, 'Indica status o plan')

export async function updatePartnerOrganization(
  service: Service,
  partner: Partner,
  orgId: string,
  input: z.infer<typeof updateOrgSchema>
): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(orgId).success) return apiError('not_found', 404)
  const found = await loadOrg(service, partner.id, { id: orgId })
  if (!found) return apiError('not_found', 404)

  const { error } = await service
    .from('subscriptions')
    .update({
      // Suspender = sin acceso al panel y sin recepcionista, con los datos intactos.
      ...(input.status ? { status: input.status === 'active' ? 'active' : 'canceled' } : {}),
      ...(input.plan ? { plan_id: input.plan } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', orgId)
    // Solo suscripciones administradas por el socio: nunca una de Stripe.
    .is('stripe_subscription_id', null)
  if (error) return apiError('update_failed', 500)

  const fresh = await loadOrg(service, partner.id, { id: orgId })
  return fresh ? json(describeOrg(fresh.org, fresh.sub)) : apiError('not_found', 404)
}
