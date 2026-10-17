'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendToCustomerByChannel } from '@/features/agente-ia/senders'
import { enqueueOrderEvent } from './service'
import { nextStatuses, orderReadyText, ORDER_STATUSES, type OrderStatus } from './parse'

export type OrderActionResult = { ok: true; warning?: string } | { ok: false; error: string }

const statusSchema = z.object({ orderId: z.string().uuid(), status: z.enum(ORDER_STATUSES) })

/**
 * Avanza un pedido en el tablero. La sesión comprueba que el pedido es de SU
 * organización (RLS); la escritura va con service_role (nadie con sesión
 * escribe en `orders`). Al pasar a «Listo» se avisa al cliente por WhatsApp,
 * una sola vez; fuera de la ventana de 24 h Meta lo rechaza y se dice aquí.
 */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<OrderActionResult> {
  const parsed = statusSchema.safeParse({ orderId, status })
  if (!parsed.success) return { ok: false, error: 'Datos no válidos.' }

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, organization_id, status, customer_name, delivery_mode, conversation_id, ready_notified_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return { ok: false, error: 'No encontramos ese pedido.' }
  if (!nextStatuses(order.status as OrderStatus).includes(status)) return { ok: false, error: 'Ese pedido ya cambió. Actualiza la página.' }

  const service = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await service
    .from('orders')
    .update({
      status,
      updated_at: now,
      ...(status === 'ready' ? { ready_at: now } : {}),
      ...(status === 'delivered' ? { delivered_at: now } : {}),
    })
    .eq('id', orderId)
    .eq('status', order.status)
  if (error) return { ok: false, error: 'No se pudo guardar. Intenta de nuevo.' }

  let warning: string | undefined
  if (status === 'ready' && !order.ready_notified_at && order.conversation_id) {
    warning = await notifyReady(service, order as ReadyOrder)
  }
  after(() => enqueueOrderEvent(service, order.organization_id, 'order.updated', orderId).catch(() => undefined))
  revalidatePath('/dashboard/pedidos')
  return { ok: true, ...(warning ? { warning } : {}) }
}

type ReadyOrder = { id: string; conversation_id: string; customer_name: string | null; delivery_mode: string }

async function notifyReady(service: ReturnType<typeof createServiceClient>, order: ReadyOrder): Promise<string | undefined> {
  const { data: conv } = await service
    .from('conversations')
    .select('id, client:clients(phone), channel:channels(type, external_id)')
    .eq('id', order.conversation_id)
    .maybeSingle()
  const phone = (conv?.client as unknown as { phone: string | null } | null)?.phone
  const channel = conv?.channel as unknown as { type: string; external_id: string } | null
  if (!phone || !channel) return 'No encontramos a quién avisar.'
  const text = orderReadyText({ customerName: order.customer_name, mode: order.delivery_mode === 'delivery' ? 'delivery' : 'pickup' })
  const extId = await sendToCustomerByChannel(service, channel.type, channel.external_id, phone, text)
  if (!extId) return 'No se pudo avisar al cliente por WhatsApp (si pasaron más de 24 horas desde su último mensaje, Meta no deja escribirle). Avísale por otro medio.'
  await Promise.all([
    service.rpc('log_outbound_message', { p_conversation_id: order.conversation_id, p_body: text, p_sender: 'agent', p_external_id: extId }),
    service.from('orders').update({ ready_notified_at: new Date().toISOString() }).eq('id', order.id),
  ])
  return undefined
}

const etaSchema = z.number().int().min(5).max(240)

/** Tiempo estimado que promete la confirmación del pedido. Dueño o gerente. */
export async function setOrderEta(minutes: number): Promise<OrderActionResult> {
  if (!etaSchema.safeParse(minutes).success) return { ok: false, error: 'Escribe entre 5 y 240 minutos.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión terminó.' }
  const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).maybeSingle()
  if (!profile?.organization_id || !['owner', 'manager'].includes(profile.role)) return { ok: false, error: 'Solo el dueño o un gerente pueden cambiarlo.' }
  const { error } = await createServiceClient().from('organizations').update({ order_eta_minutes: minutes }).eq('id', profile.organization_id)
  if (error) return { ok: false, error: 'No se pudo guardar.' }
  revalidatePath('/dashboard/pedidos')
  return { ok: true }
}
