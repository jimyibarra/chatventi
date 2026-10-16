'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendToCustomerByChannel } from './senders'
import type { ActionResult } from './actions'

// =====================================================================
// Aprobar o descartar DESDE EL PANEL la respuesta que la recepcionista dejó
// esperando visto bueno. Hasta el 16-oct-2026 solo se podía por Telegram: sin
// Telegram configurado, la plática quedaba muda para siempre.
//   · Aprobar  → se envía tal cual (como respuesta de la IA).
//   · Descartar → la plática queda «Te espera» para que el equipo conteste.
// Editar antes de enviar lo resuelve el cuadro de mensaje (sendManualReply).
// =====================================================================

const idSchema = z.string().uuid()

type Resolved = {
  already_resolved?: boolean
  draft?: string
  conversation_id?: string
  channel_type?: string
  channel_external_id?: string
  send_to?: string
}

export async function resolveApprovalFromPanel(approvalId: string, approve: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(approvalId).success) return { ok: false, error: 'Respuesta no válida.' }

  // Sesión: la RLS solo deja ver las aprobaciones de SU organización.
  const supabase = await createClient()
  const { data: mine } = await supabase.from('ai_approvals').select('id, conversation_id, status').eq('id', approvalId).maybeSingle()
  if (!mine) return { ok: false, error: 'No encontramos esa respuesta.' }
  if (mine.status !== 'pending') return { ok: false, error: 'Esa respuesta ya se resolvió. Actualiza la página.' }

  const service = createServiceClient()
  const { data, error } = await service.rpc('resolve_ai_approval', { p_approval_id: approvalId, p_approved: approve })
  if (error) return { ok: false, error: 'No se pudo procesar. Intenta de nuevo.' }
  const res = (data ?? {}) as Resolved
  if (res.already_resolved) return { ok: false, error: 'Esa respuesta ya se resolvió. Actualiza la página.' }

  if (approve && res.draft) {
    // El chat de la página web lee de la base: registrar ES entregar.
    const extId =
      res.channel_type === 'web'
        ? null
        : res.channel_type && res.channel_external_id && res.send_to
          ? await sendToCustomerByChannel(service, res.channel_type, res.channel_external_id, res.send_to, res.draft)
          : null
    if (res.channel_type !== 'web' && !extId) {
      // No salió: vuelve a pendiente para que el equipo la edite o reintente.
      await service.from('ai_approvals').update({ status: 'pending', resolved_at: null }).eq('id', approvalId)
      await service.from('conversations').update({ status: 'pending' }).eq('id', mine.conversation_id)
      return { ok: false, error: 'No se pudo enviar (revisa la conexión del número). Puedes editarla y mandarla tú.' }
    }
    const { error: logError } = await service.rpc('log_outbound_message', {
      p_conversation_id: mine.conversation_id,
      p_body: res.draft,
      p_sender: 'ai',
      p_external_id: extId ?? undefined,
    })
    if (logError) console.error('[resolveApprovalFromPanel] log_outbound_message', logError.message)
  }

  revalidatePath(`/dashboard/conversaciones/${mine.conversation_id}`)
  revalidatePath('/dashboard/conversaciones')
  return { ok: true }
}
