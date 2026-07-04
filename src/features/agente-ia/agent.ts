import { generateText, tool, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { AgentContext, AgentSenders, RunAgentResult } from './types'

type AnyClient = SupabaseClient<Database>

// -------------------------------------------------------------------
// Prompt del sistema: acota al negocio (regla Meta: sin chatbots genéricos)
// -------------------------------------------------------------------
function buildSystemPrompt(ctx: AgentContext): string {
  const tz = ctx.branch?.timezone ?? 'America/Mexico_City'
  const today = new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  const services = ctx.services.length
    ? ctx.services
        .map(
          (s) =>
            `- ${s.name} (${s.duration_minutes} min${s.price != null ? `, $${s.price}` : ''})${
              s.description ? `: ${s.description}` : ''
            }`
        )
        .join('\n')
    : '(sin servicios configurados)'

  const knowledge = ctx.knowledge.length
    ? ctx.knowledge.map((k) => `- ${k}`).join('\n')
    : '(sin información adicional)'

  return [
    ctx.config?.system_prompt?.trim() ||
      'Eres el recepcionista virtual de un negocio de servicios. Ayudas a los clientes a agendar, reagendar o cancelar citas y respondes dudas sobre el negocio.',
    '',
    'REGLAS IMPORTANTES:',
    '- Responde SOLO sobre este negocio: sus servicios, citas, horarios y la información de la base de conocimiento. Si te preguntan algo ajeno al negocio, decláralo con amabilidad y redirige.',
    '- Habla en español, con tono cálido y breve (es un chat de WhatsApp/Telegram).',
    '- Para agendar necesitas: el/los servicio(s) y una fecha. Usa la herramienta check_availability para ofrecer horarios reales; nunca inventes disponibilidad.',
    '- Confirma con el cliente antes de reservar. Reserva con book_appointment SOLO cuando el cliente eligió un horario concreto.',
    '- Si no puedes resolver algo o hay una queja/caso delicado, usa request_human_approval con un borrador de respuesta para que un humano lo revise.',
    `- Hoy es ${today} (zona horaria ${tz}).`,
    '',
    `SERVICIOS DEL NEGOCIO${ctx.branch ? ` (sucursal ${ctx.branch.name})` : ''}:`,
    services,
    '',
    'BASE DE CONOCIMIENTO:',
    knowledge,
  ].join('\n')
}

// Historial -> mensajes del modelo (contact=user, ai/agent=assistant).
function toModelMessages(ctx: AgentContext) {
  return ctx.messages
    .filter((m) => (m.body ?? '').trim().length > 0)
    .map((m) => ({
      role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: m.body as string,
    }))
}

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

// -------------------------------------------------------------------
// Orquestador: obtiene contexto, corre el LLM con herramientas y decide
// enviar directo o enrutar a aprobación humana.
// -------------------------------------------------------------------
export async function runAgent(params: {
  channelType: 'whatsapp' | 'telegram'
  externalId: string
  fromHandle: string
  supabase: AnyClient
  senders: AgentSenders
}): Promise<RunAgentResult> {
  const { channelType, externalId, fromHandle, supabase, senders } = params

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { handled: false, reason: 'sin OPENROUTER_API_KEY' }

  const { data: ctxData, error: ctxErr } = await supabase.rpc('get_agent_context', {
    p_channel_type: channelType,
    p_external_id: externalId,
    p_from_handle: fromHandle,
  })
  if (ctxErr || !ctxData) return { handled: false, reason: 'sin contexto' }

  const ctx = ctxData as unknown as AgentContext
  if (!ctx.conversation?.should_respond) {
    return { handled: false, reason: 'no debe responder (pausa/desactivado/pendiente)' }
  }
  if (!ctx.branch) return { handled: false, reason: 'sin sucursal' }

  const tz = ctx.branch.timezone
  const branchId = ctx.branch.id

  // Bandera de escalamiento fijada por la tool request_human_approval.
  let approvalRequested = false
  let approvalDraft = ''

  const openrouter = createOpenRouter({ apiKey })
  const model = openrouter(ctx.config?.model || 'openai/gpt-4o-mini')

  const tools = {
    check_availability: tool({
      description:
        'Consulta los horarios disponibles para uno o más servicios en una fecha. Devuelve horas libres reales.',
      inputSchema: z.object({
        service_ids: z.array(z.string().uuid()).min(1),
        date: z.string().describe('Fecha en formato YYYY-MM-DD'),
      }),
      execute: async ({ service_ids, date }) => {
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_branch_id: branchId,
          p_service_ids: service_ids,
          p_date: date,
        })
        if (error) return { error: 'No pude consultar disponibilidad.' }
        const slots = (data ?? []) as { slot_start: string }[]
        if (slots.length === 0) return { available: [], note: 'Sin horarios ese día.' }
        // Compactamos a horas locales legibles (máx 12 para no saturar).
        const times = slots.slice(0, 12).map((s) => fmtTime(s.slot_start, tz))
        return { date, available_times: times, iso: slots.slice(0, 12).map((s) => s.slot_start) }
      },
    }),
    book_appointment: tool({
      description:
        'Agenda una cita para el cliente actual. Úsalo solo cuando el cliente confirmó servicio(s) y un horario concreto (usa el valor ISO devuelto por check_availability).',
      inputSchema: z.object({
        service_ids: z.array(z.string().uuid()).min(1),
        starts_at: z.string().describe('Instante ISO 8601 del inicio (de check_availability)'),
      }),
      execute: async ({ service_ids, starts_at }) => {
        const { data, error } = await supabase.rpc('create_appointment_from_chat', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_service_ids: service_ids,
          p_starts_at: starts_at,
        })
        if (error) {
          if (error.message.includes('slot_taken'))
            return { ok: false, error: 'Ese horario acaba de ocuparse. Ofrece otro.' }
          return { ok: false, error: 'No pude agendar. Intenta con otro horario.' }
        }
        return { ok: true, appointment_id: data, confirmed_at: fmtTime(starts_at, tz) }
      },
    }),
    request_human_approval: tool({
      description:
        'Escala a un humano cuando no puedas resolver, haya una queja o un caso delicado. Pasa un borrador de respuesta para que la persona lo revise.',
      inputSchema: z.object({
        draft: z.string().describe('Borrador de respuesta para el cliente'),
      }),
      execute: async ({ draft }) => {
        approvalRequested = true
        approvalDraft = draft
        return { escalated: true }
      },
    }),
  }

  let text = ''
  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt(ctx),
      messages: toModelMessages(ctx),
      tools,
      stopWhen: stepCountIs(6),
    })
    text = result.text?.trim() ?? ''
  } catch (err) {
    console.error('[agent] generateText error', err)
    return { handled: false, reason: 'error del modelo' }
  }

  const convId = ctx.conversation.id
  const approvalMode = ctx.config?.approval_mode ?? 'low_confidence'
  const needsApproval =
    approvalMode === 'always' || (approvalMode === 'low_confidence' && approvalRequested)

  const reply = (approvalRequested ? approvalDraft : text).trim()
  if (!reply) return { handled: false, reason: 'respuesta vacía' }

  if (needsApproval) {
    const { data: appr } = await supabase.rpc('create_ai_approval', {
      p_conversation_id: convId,
      p_draft: reply,
      p_action: null,
    })
    const info = appr as { approval_id?: string; approval_chat_id?: string } | null
    if (info?.approval_chat_id && info.approval_id) {
      await senders.sendApproval(info.approval_chat_id, reply, info.approval_id)
    }
    return { handled: true, mode: 'approval', reply }
  }

  const extId = await senders.sendToCustomer(reply)
  await supabase.rpc('log_outbound_message', {
    p_conversation_id: convId,
    p_body: reply,
    p_sender: 'ai',
    p_external_id: extId ?? undefined,
  })
  return { handled: true, mode: 'sent', reply }
}
