import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

export type PushPayload = {
  title: string
  body?: string
  tag?: string
  data?: { url?: string }
}

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contacto@chatventi.com',
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
}

// Envía push a todas las suscripciones de un usuario y registra la
// notificación in-app. Limpia suscripciones inválidas (gotcha: Apple
// falla en silencio sin statusCode -> también se elimina).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const service = createServiceClient()

  await service.from('notifications').insert({
    user_id: userId,
    type: payload.tag ?? 'general',
    title: payload.title,
    body: payload.body ?? null,
    data: payload.data ?? {},
  })

  if (!ensureVapid()) return 0

  const { data: subs } = await service
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return 0

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      await service
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id)
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 4xx (menos 429) o sin status (Apple silencioso) = suscripción muerta.
      if ((status && status >= 400 && status < 500 && status !== 429) || !status) {
        await service.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return sent
}

// Notifica a TODOS los owners de una organización (caso de uso ChatVenti:
// aprobación pendiente o conversación escalada a humano).
export async function notifyOrgOwners(orgId: string, payload: PushPayload): Promise<void> {
  try {
    const service = createServiceClient()
    const { data: owners } = await service
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', 'owner')

    for (const owner of owners ?? []) {
      await sendPushToUser(owner.id, payload)
    }
  } catch (err) {
    // El push nunca debe tumbar el flujo del webhook/agente.
    console.error('[notifications] notifyOrgOwners error', err)
  }
}
