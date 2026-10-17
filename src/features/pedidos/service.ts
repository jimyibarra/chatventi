import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import { sendToCustomerByChannel } from '@/features/agente-ia/senders'
import { notifyOrgOwners } from '@/features/notifications/send'
import { dispatchPartnerWebhooks } from '@/features/socios/webhooks'
import { itemsSummary, orderConfirmationText, type ParsedOrder } from './parse'

// =====================================================================
// Pedidos por WhatsApp (fase 2, 17-oct-2026). El webhook reconoce el pedido
// del carrito (parse.ts) y llama aquí, DESPUÉS de responder 200 a Meta:
//   1. Guarda el pedido (un reintento de Meta no lo duplica).
//   2. Confirma al cliente con el tiempo del negocio, si la recepcionista
//      está activa en esa plática (si el dueño la pausó, no se mete).
//   3. Avisa al equipo (panel/celular) y al socio (order.created).
// =====================================================================

type Service = SupabaseClient<Database>

/** Aviso al socio del negocio (p. ej. ¡Pasen!, para su reporte mensual). */
export async function enqueueOrderEvent(service: Service, orgId: string, event: 'order.created' | 'order.updated', orderId: string) {
  const { data: org } = await service.from('organizations').select('partner_id').eq('id', orgId).maybeSingle()
  if (!org?.partner_id) return
  const { data: partner } = await service.from('partners').select('webhook_url, status').eq('id', org.partner_id).maybeSingle()
  if (!partner?.webhook_url || partner.status !== 'active') return
  await service.from('partner_webhook_deliveries').insert({ partner_id: org.partner_id, organization_id: orgId, event, payload: { orderId } as Json })
  await dispatchPartnerWebhooks(service, { onlyPartner: org.partner_id }).catch(() => null)
}

export async function handleIncomingOrder(
  service: Service,
  p: { phoneNumberId: string; from: string; messageId: string; order: ParsedOrder }
): Promise<void> {
  try {
    const { data: msg } = await service.from('messages').select('conversation_id').eq('id', p.messageId).maybeSingle()
    if (!msg) return
    const { data: conv } = await service
      .from('conversations')
      .select('id, organization_id, client_id, ai_enabled, ai_paused_until')
      .eq('id', msg.conversation_id)
      .maybeSingle()
    if (!conv) return
    const orgId = conv.organization_id
    const [{ data: org }, { data: cfg }] = await Promise.all([
      service.from('organizations').select('order_eta_minutes').eq('id', orgId).maybeSingle(),
      service.from('agent_configs').select('enabled').eq('organization_id', orgId).maybeSingle(),
    ])
    const eta = org?.order_eta_minutes ?? 30

    const { data: saved, error } = await service
      .from('orders')
      .insert({
        organization_id: orgId,
        conversation_id: conv.id,
        client_id: conv.client_id,
        source_message_id: p.messageId,
        customer_name: p.order.customerName,
        items: p.order.items as unknown as Json,
        total_text: p.order.totalText,
        delivery_mode: p.order.mode,
        address: p.order.address,
        notes: p.order.notes,
        eta_minutes: eta,
      })
      .select('id')
      .maybeSingle()
    // 23505 = ese mensaje ya tenía pedido (reintento de Meta): nada que hacer.
    if (error || !saved) {
      if (error?.code !== '23505') console.error('[pedidos] guardar', error?.message)
      return
    }

    // El nombre del pedido rellena la ficha si el cliente aún no tenía nombre.
    if (conv.client_id && p.order.customerName) {
      await service.from('clients').update({ name: p.order.customerName }).eq('id', conv.client_id).is('name', null)
    }

    const paused = !!conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date()
    if (cfg?.enabled && conv.ai_enabled && !paused) {
      const text = orderConfirmationText(p.order, eta)
      const extId = await sendToCustomerByChannel(service, 'whatsapp', p.phoneNumberId, p.from, text)
      await service.rpc('log_outbound_message', { p_conversation_id: conv.id, p_body: text, p_sender: 'ai', p_external_id: extId ?? undefined })
    }

    await notifyOrgOwners(orgId, {
      title: 'Nuevo pedido 🍽️',
      body: `${p.order.customerName ?? 'Un cliente'}: ${itemsSummary(p.order.items)}`.slice(0, 160),
      tag: 'order',
      data: { url: '/dashboard/pedidos' },
    }).catch(() => null)
    await enqueueOrderEvent(service, orgId, 'order.created', saved.id)
  } catch (err) {
    console.error('[pedidos] pedido entrante', err instanceof Error ? err.message : err)
  }
}
