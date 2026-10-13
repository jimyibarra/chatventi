import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import { partnerAppOrigin, type Partner } from './service'
import { signWebhook, newWebhookSecret } from './webhooks-sign'
export { signWebhook, verifyWebhookSignature, newWebhookSecret, validateWebhookUrl } from './webhooks-sign'

// =====================================================================
// Webhooks salientes de la API de socios (v2).
//
//   Un socio registra UN endpoint https. Cada vez que se crea o cambia una
//   cita de uno de sus negocios, un disparador en la base encola una entrega
//   y despierta a /api/cron/partner-webhooks; aquí se arma el cuerpo con el
//   estado ACTUAL de la cita, se firma con HMAC-SHA256 y se envía. Lo que
//   falla se reintenta (1 min, 5 min, 30 min, 2 h, 12 h) y a los 6 intentos
//   se abandona. La corrida de cada 15 min también despacha, por si el kick
//   de pg_net no llegó.
// =====================================================================

type Service = SupabaseClient<Database>
type DeliveryRow = Database['public']['Tables']['partner_webhook_deliveries']['Row']

export const WEBHOOK_EVENTS = ['appointment.created', 'appointment.updated', 'appointment.cancelled', 'webhook.test'] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

const TIMEOUT_MS = 10_000
const MAX_BODY_PREVIEW = 300

// ---------------------------------------------------------------------
// Configuración del socio (GET/PUT/DELETE /webhook)
// ---------------------------------------------------------------------
export type WebhookConfig = { url: string | null; secretPrefix: string | null; createdAt: string | null; events: readonly string[] }

export async function getWebhookConfig(service: Service, partnerId: string): Promise<WebhookConfig> {
  const { data } = await service.from('partners').select('webhook_url, webhook_secret, webhook_created_at').eq('id', partnerId).maybeSingle()
  return {
    url: data?.webhook_url ?? null,
    secretPrefix: data?.webhook_secret ? `${data.webhook_secret.slice(0, 8)}…` : null,
    createdAt: data?.webhook_created_at ?? null,
    events: WEBHOOK_EVENTS,
  }
}

/** Guarda la URL y genera un secreto NUEVO (el anterior deja de valer). Devuelve el secreto: se muestra una sola vez. */
export async function setWebhook(service: Service, partnerId: string, url: string): Promise<{ secret: string; createdAt: string }> {
  const secret = newWebhookSecret()
  const createdAt = new Date().toISOString()
  const { error } = await service
    .from('partners')
    .update({ webhook_url: url, webhook_secret: secret, webhook_created_at: createdAt })
    .eq('id', partnerId)
  if (error) throw new Error(error.message)
  return { secret, createdAt }
}

export async function clearWebhook(service: Service, partnerId: string): Promise<void> {
  const { error } = await service
    .from('partners')
    .update({ webhook_url: null, webhook_secret: null, webhook_created_at: null })
    .eq('id', partnerId)
  if (error) throw new Error(error.message)
  // Lo pendiente ya no tiene a dónde ir.
  await service.from('partner_webhook_deliveries').delete().eq('partner_id', partnerId).is('delivered_at', null)
}

// ---------------------------------------------------------------------
// Cuerpo de la entrega: se arma al enviar, con la cita como está AHORA.
// ---------------------------------------------------------------------
type AppointmentPayload = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  timezone: string | null
  source: string
  notes: string | null
  services: { id: string; externalId: string | null; name: string; durationMinutes: number; price: number | null }[]
  staff: { id: string; name: string } | null
  client: { id: string; name: string | null; phone: string | null } | null
  manageUrl: string | null
}

async function loadAppointment(service: Service, appointmentId: string, origin: string): Promise<AppointmentPayload | null> {
  const { data: a } = await service
    .from('appointments')
    .select('id, status, starts_at, ends_at, source, notes, manage_token, client_id, resource_id, branch_id')
    .eq('id', appointmentId)
    .maybeSingle()
  if (!a) return null
  const [{ data: branch }, { data: svcRows }, { data: staff }, { data: client }] = await Promise.all([
    service.from('branches').select('timezone').eq('id', a.branch_id).maybeSingle(),
    service.from('appointment_services').select('service_id').eq('appointment_id', a.id),
    a.resource_id ? service.from('resources').select('id, name').eq('id', a.resource_id).maybeSingle() : Promise.resolve({ data: null }),
    a.client_id ? service.from('clients').select('id, name, phone').eq('id', a.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const ids = (svcRows ?? []).map((r) => r.service_id)
  const { data: services } = ids.length
    ? await service.from('service_catalogs').select('id, partner_ref, name, duration_minutes, price').in('id', ids)
    : { data: [] }
  return {
    id: a.id,
    status: a.status,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    timezone: branch?.timezone ?? null,
    source: a.source,
    notes: a.notes,
    services: (services ?? []).map((s) => ({ id: s.id, externalId: s.partner_ref, name: s.name, durationMinutes: s.duration_minutes, price: s.price })),
    staff: staff ? { id: staff.id, name: staff.name } : null,
    client: client ? { id: client.id, name: client.name, phone: client.phone } : null,
    manageUrl: a.manage_token ? `${origin}/c/${a.manage_token}` : null,
  }
}

export async function buildDeliveryBody(service: Service, d: DeliveryRow, partner: Pick<Partner, 'app_domain'>): Promise<Record<string, unknown>> {
  const base = { id: d.id, event: d.event, createdAt: d.created_at, attempt: d.attempts }
  if (d.event === 'webhook.test') return { ...base, test: true, organization: null }
  const [{ data: org }, appointment] = await Promise.all([
    d.organization_id ? service.from('organizations').select('id, partner_ref, name').eq('id', d.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    d.appointment_id ? loadAppointment(service, d.appointment_id, partnerAppOrigin(partner)) : Promise.resolve(null),
  ])
  return {
    ...base,
    organization: org ? { id: org.id, externalId: org.partner_ref, name: org.name } : null,
    // Una cita borrada entre el evento y el envío llega con su id y status 'deleted'.
    appointment: appointment ?? (d.appointment_id ? { id: d.appointment_id, status: 'deleted' } : null),
  }
}

// ---------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------
export type DispatchSummary = { claimed: number; delivered: number; failed: number; skipped: number }

type Fetcher = (url: string, init: RequestInit) => Promise<Response>

export async function dispatchPartnerWebhooks(
  service: Service,
  opts: { limit?: number; fetcher?: Fetcher; onlyPartner?: string } = {}
): Promise<DispatchSummary> {
  const fetcher: Fetcher = opts.fetcher ?? ((u, i) => fetch(u, i))
  const summary: DispatchSummary = { claimed: 0, delivered: 0, failed: 0, skipped: 0 }
  const { data: claimed, error } = await service.rpc('claim_partner_webhook_deliveries', { p_limit: opts.limit ?? 25 })
  if (error) {
    console.error('[webhooks] claim', error.message)
    return summary
  }
  const rows = (claimed ?? []) as DeliveryRow[]
  summary.claimed = rows.length
  if (rows.length === 0) return summary

  const partnerIds = [...new Set(rows.map((r) => r.partner_id))]
  const { data: partners } = await service
    .from('partners')
    .select('id, status, webhook_url, webhook_secret, app_domain')
    .in('id', partnerIds)
  const byPartner = new Map((partners ?? []).map((p) => [p.id, p]))

  for (const d of rows) {
    if (opts.onlyPartner && d.partner_id !== opts.onlyPartner) continue
    const p = byPartner.get(d.partner_id)
    if (!p?.webhook_url || !p.webhook_secret || p.status !== 'active') {
      // Sin destino: se da por cerrada para que no se reintente.
      await service
        .from('partner_webhook_deliveries')
        .update({ delivered_at: new Date().toISOString(), last_status: 0, last_error: 'sin_webhook' })
        .eq('id', d.id)
      summary.skipped++
      continue
    }
    const body = JSON.stringify(await buildDeliveryBody(service, d, { app_domain: p.app_domain }))
    const ts = String(Math.floor(Date.now() / 1000))
    let status = 0
    let errText: string | null = null
    try {
      const res = await fetcher(p.webhook_url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'ChatVenti-Webhooks/1.0',
          'x-chatventi-event': d.event,
          'x-chatventi-delivery': d.id,
          'x-chatventi-timestamp': ts,
          'x-chatventi-signature': signWebhook(p.webhook_secret, ts, body),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'manual',
      })
      status = res.status
      if (!(res.status >= 200 && res.status < 300)) {
        errText = `HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, MAX_BODY_PREVIEW)}`
      }
    } catch (err) {
      errText = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, MAX_BODY_PREVIEW)
    }
    const ok = !errText
    await service
      .from('partner_webhook_deliveries')
      .update({ last_status: status, last_error: errText, ...(ok ? { delivered_at: new Date().toISOString() } : {}) })
      .eq('id', d.id)
    if (ok) summary.delivered++
    else summary.failed++
  }
  return summary
}

/** POST /webhook/test: encola un `webhook.test` y lo despacha ya. Devuelve cómo le fue a ESA entrega. */
export async function sendTestDelivery(
  service: Service,
  partnerId: string
): Promise<{ deliveryId: string; delivered: boolean; status: number | null; error: string | null }> {
  const { data: row, error } = await service
    .from('partner_webhook_deliveries')
    .insert({ partner_id: partnerId, event: 'webhook.test', payload: { test: true } as Json })
    .select('id')
    .single()
  if (error || !row) throw new Error(error?.message ?? 'insert_failed')
  await dispatchPartnerWebhooks(service, { limit: 50, onlyPartner: partnerId })
  const { data: after } = await service
    .from('partner_webhook_deliveries')
    .select('delivered_at, last_status, last_error')
    .eq('id', row.id)
    .maybeSingle()
  return {
    deliveryId: row.id,
    delivered: !!after?.delivered_at && !after.last_error,
    status: after?.last_status ?? null,
    error: after?.last_error ?? null,
  }
}
