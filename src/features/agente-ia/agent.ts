import { generateText, tool, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyOrgOwners } from '@/features/notifications/send'
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
            `- ${s.name} — id: ${s.id} (${s.duration_minutes} min${
              s.price != null ? `, $${s.price}` : ''
            })${s.description ? `: ${s.description}` : ''}`
        )
        .join('\n')
    : '(sin servicios configurados)'

  const knowledge = ctx.knowledge.length
    ? ctx.knowledge.map((k) => `- ${k}`).join('\n')
    : '(sin información adicional)'

  const products = ctx.products?.length
    ? ctx.products
        .map(
          (p) =>
            `- ${p.name}${p.price != null ? ` — $${p.price}` : ''}${
              p.description ? `: ${p.description}` : ''
            }`
        )
        .join('\n')
    : null

  const upcoming = ctx.upcoming_appointments?.length
    ? ctx.upcoming_appointments
        .map(
          (a) =>
            `- ${a.services} — ${fmtDateTime(a.starts_at, tz)} (estado: ${a.status}, id: ${a.id})`
        )
        .join('\n')
    : '(sin citas próximas)'

  return [
    ctx.config?.system_prompt?.trim() ||
      'Eres el recepcionista virtual de un negocio de servicios. Ayudas a los clientes a agendar, reagendar o cancelar citas y respondes dudas sobre el negocio.',
    '',
    'REGLAS IMPORTANTES:',
    '- Responde SOLO sobre este negocio: sus servicios, citas, horarios y la información de la base de conocimiento. Si te preguntan algo ajeno al negocio, decláralo con amabilidad y redirige. Si el cliente insiste con temas ajenos por segunda vez consecutiva, usa request_human_approval.',
    '- Habla en español, con tono cálido y breve (es un chat de WhatsApp/Telegram). UNA sola pregunta por mensaje.',
    '- NUNCA re-preguntes datos que ya están en el historial (servicio, fecha, nombre): úsalos directamente.',
    '- Para agendar necesitas: el/los servicio(s) y una fecha. Usa la herramienta check_availability para ofrecer horarios reales; nunca inventes disponibilidad. Ofrece MÁXIMO 3 horarios por mensaje. Al llamar las herramientas, usa el id EXACTO del servicio (el uuid mostrado en la lista de servicios).',
    '- Confirma con el cliente antes de reservar. Reserva con book_appointment SOLO cuando el cliente eligió un horario concreto. Si el cliente ya fue explícito con servicio y horario, reserva directo sin re-preguntar.',
    '- Para CANCELAR o REAGENDAR usa cancel_appointment / reschedule_appointment con el id EXACTO de la lista CITAS PRÓXIMAS DEL CLIENTE. Si tiene varias citas, pregunta cuál UNA sola vez. Si no tiene citas próximas, dilo con amabilidad. Para reagendar, primero consulta disponibilidad con check_availability.',
    '- Si el cliente cambia de opinión a mitad del proceso, simplemente continúa con lo nuevo; no lo hagas repetir todo.',
    '- Cuando una herramienta de reservar/cancelar/reagendar tenga ÉXITO, tu texto final debe ser UNA frase corta y cálida SIN repetir fecha ni hora (el sistema envía la confirmación exacta por ti).',
    '- Si no puedes resolver algo o hay una queja/caso delicado, usa request_human_approval con un borrador de respuesta para que un humano lo revise.',
    `- Hoy es ${today} (zona horaria ${tz}).`,
    '',
    `SERVICIOS DEL NEGOCIO${ctx.branch ? ` (sucursal ${ctx.branch.name})` : ''}:`,
    services,
    '',
    ...(products
      ? [
          'PRODUCTOS DEL NEGOCIO (responde precio/detalles; para apartar uno, dile al cliente que lo confirmas con el equipo y usa request_human_approval con el pedido como borrador):',
          products,
          '',
        ]
      : []),
    'CITAS PRÓXIMAS DEL CLIENTE:',
    upcoming,
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

// "jueves 10 de julio, 16:00" en la zona horaria de la sucursal.
function fmtDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

// -------------------------------------------------------------------
// Confirmación estructurada: la construye el CÓDIGO (no el modelo) para
// que fecha/hora/servicio sean siempre exactos y en la tz de la sucursal.
// -------------------------------------------------------------------
type ChatAction =
  | { kind: 'booked'; services: string; startsAt: string; manageUrl?: string | null }
  | { kind: 'rescheduled'; services: string; startsAt: string; manageUrl?: string | null }
  | { kind: 'cancelled'; services: string; startsAt: string }

function buildConfirmation(action: ChatAction, tz: string, branchName: string): string {
  const when = fmtDateTime(action.startsAt, tz)
  // Enlace mágico (Ola 2): el cliente gestiona su cita sin login.
  const link =
    action.kind !== 'cancelled' && action.manageUrl
      ? `\n🔗 Gestiona tu cita aquí: ${action.manageUrl}`
      : ''
  switch (action.kind) {
    case 'booked':
      return `✅ *Cita confirmada*\n📅 ${when}\n🔹 ${action.services}\n📍 ${branchName}${link}`
    case 'rescheduled':
      return `🔄 *Cita reagendada*\n📅 Nueva fecha: ${when}\n🔹 ${action.services}\n📍 ${branchName}${link}`
    case 'cancelled':
      return `❌ *Cita cancelada*\n📅 Era: ${when}\n🔹 ${action.services}`
  }
}

// URL pública de gestión de una cita del cliente actual (o null si falla).
async function fetchManageUrl(
  supabase: AnyClient,
  params: {
    channelType: string
    externalId: string
    fromHandle: string
    appointmentId: string
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_manage_token_from_chat', {
    p_channel_type: params.channelType,
    p_external_id: params.externalId,
    p_client_phone: params.fromHandle,
    p_appointment_id: params.appointmentId,
  })
  if (error || !data) return null
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com'
  return `${base.replace(/\/$/, '')}/c/${data}`
}

// Respuesta estática si el modelo falla: el cliente NUNCA se queda en silencio.
const FALLBACK_REPLY =
  'Disculpa, tuve un problema técnico en este momento 🙏 Ya avisé a una persona del equipo para que te atienda en breve.'

// Borrador que el humano puede aprobar (se envía al cliente tal cual).
const FALLBACK_DRAFT =
  'Hola 👋 Soy parte del equipo y ya estoy al pendiente de tu mensaje. ¿Me confirmas en qué te puedo ayudar?'

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

  // Gating del módulo IA: con el cobro activo, la org debe tener el módulo
  // Recepcionista IA vigente (trial/activo). Con BILLING_ENFORCED apagado no
  // bloquea nada (rollout suave). Se consulta con service_role (el cliente del
  // webhook es anon y no puede ejecutar org_has_ai).
  if (process.env.BILLING_ENFORCED === 'true') {
    try {
      const admin = createServiceClient()
      const { data: hasAi } = await admin.rpc('org_has_ai', { p_org: ctx.org_id })
      if (!hasAi) return { handled: false, reason: 'módulo IA no contratado' }
    } catch (e) {
      console.error('[agent] gating IA error', e)
    }
  }

  const tz = ctx.branch.timezone
  const branchId = ctx.branch.id

  // Bandera de escalamiento fijada por la tool request_human_approval.
  let approvalRequested = false
  let approvalDraft = ''
  // Acciones ejecutadas con éxito en este turno -> confirmación estructurada.
  const actions: ChatAction[] = []
  // Últimos horarios ofrecidos por check_availability -> botones de opción.
  let offeredSlots: { id: string; title: string }[] = []

  const serviceNames = (ids: string[]): string =>
    ids
      .map((id) => ctx.services.find((s) => s.id === id)?.name ?? 'Servicio')
      .join(' + ')
  const upcomingById = (id: string) =>
    (ctx.upcoming_appointments ?? []).find((a) => a.id === id)

  const openrouter = createOpenRouter({ apiKey })
  const model = openrouter(ctx.config?.model || 'openai/gpt-4o-mini')

  const tools = {
    check_availability: tool({
      description:
        'Consulta los horarios disponibles para uno o más servicios en una fecha. Devuelve horas libres reales (máx 3).',
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
        // Máx 3 horarios por mensaje (anti-fatiga): mañana / mediodía / tarde
        // cuando hay muchos, para dar opciones repartidas del día.
        const pick =
          slots.length <= 3
            ? slots
            : [slots[0], slots[Math.floor(slots.length / 2)], slots[slots.length - 1]]
        const times = pick.map((s) => fmtTime(s.slot_start, tz))
        // Botones de opción rápida para el mensaje final (anti-fatiga).
        offeredSlots = pick.map((s) => ({
          id: `slot:${s.slot_start}`,
          title: fmtTime(s.slot_start, tz),
        }))
        return { date, available_times: times, iso: pick.map((s) => s.slot_start) }
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
        const manageUrl = data
          ? await fetchManageUrl(supabase, {
              channelType,
              externalId,
              fromHandle,
              appointmentId: String(data),
            })
          : null
        actions.push({
          kind: 'booked',
          services: serviceNames(service_ids),
          startsAt: starts_at,
          manageUrl,
        })
        return { ok: true, appointment_id: data, confirmed_at: fmtTime(starts_at, tz) }
      },
    }),
    cancel_appointment: tool({
      description:
        'Cancela una cita del cliente actual. Usa SOLO un id de la lista CITAS PRÓXIMAS DEL CLIENTE, y solo cuando el cliente confirmó que quiere cancelar.',
      inputSchema: z.object({
        appointment_id: z.string().uuid().describe('Id de la cita (de CITAS PRÓXIMAS DEL CLIENTE)'),
      }),
      execute: async ({ appointment_id }) => {
        const appt = upcomingById(appointment_id)
        if (!appt) return { ok: false, error: 'Esa cita no está en la lista del cliente.' }
        const { error } = await supabase.rpc('cancel_appointment_from_chat', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_appointment_id: appointment_id,
        })
        if (error) {
          if (error.message.includes('not_actionable'))
            return { ok: false, error: 'Esa cita ya no se puede cancelar (pasada o ya cancelada).' }
          return { ok: false, error: 'No pude cancelar la cita. Escala a un humano si persiste.' }
        }
        actions.push({ kind: 'cancelled', services: appt.services, startsAt: appt.starts_at })
        return { ok: true }
      },
    }),
    reschedule_appointment: tool({
      description:
        'Mueve una cita del cliente actual a un nuevo horario. Usa SOLO un id de CITAS PRÓXIMAS DEL CLIENTE y un horario ISO devuelto por check_availability que el cliente eligió.',
      inputSchema: z.object({
        appointment_id: z.string().uuid().describe('Id de la cita (de CITAS PRÓXIMAS DEL CLIENTE)'),
        new_starts_at: z.string().describe('Nuevo inicio ISO 8601 (de check_availability)'),
      }),
      execute: async ({ appointment_id, new_starts_at }) => {
        const appt = upcomingById(appointment_id)
        if (!appt) return { ok: false, error: 'Esa cita no está en la lista del cliente.' }
        const { error } = await supabase.rpc('reschedule_appointment_from_chat', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_appointment_id: appointment_id,
          p_new_starts_at: new_starts_at,
        })
        if (error) {
          if (error.message.includes('slot_taken'))
            return { ok: false, error: 'Ese horario acaba de ocuparse. Ofrece otro.' }
          if (error.message.includes('not_actionable'))
            return { ok: false, error: 'Esa cita ya no se puede mover (pasada o cancelada).' }
          return { ok: false, error: 'No pude reagendar. Intenta con otro horario.' }
        }
        const manageUrl = await fetchManageUrl(supabase, {
          channelType,
          externalId,
          fromHandle,
          appointmentId: appointment_id,
        })
        actions.push({
          kind: 'rescheduled',
          services: appt.services,
          startsAt: new_starts_at,
          manageUrl,
        })
        return { ok: true, confirmed_at: fmtTime(new_starts_at, tz) }
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

  const convId = ctx.conversation.id

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
    // FALLBACK: el cliente NUNCA se queda en silencio. Respuesta estática,
    // registro como 'system' y escalamiento a humano (pausa la IA).
    try {
      const extId = await senders.sendToCustomer(FALLBACK_REPLY)
      await supabase.rpc('log_outbound_message', {
        p_conversation_id: convId,
        p_body: FALLBACK_REPLY,
        p_sender: 'system',
        p_external_id: extId ?? undefined,
      })
      const { data: appr } = await supabase.rpc('create_ai_approval', {
        p_conversation_id: convId,
        p_draft: FALLBACK_DRAFT,
        p_action: null,
      })
      const info = appr as { approval_id?: string; approval_chat_id?: string } | null
      if (info?.approval_chat_id && info.approval_id) {
        await senders.sendApproval(info.approval_chat_id, FALLBACK_DRAFT, info.approval_id)
      }
      await notifyOrgOwners(ctx.org_id, {
        title: 'Un cliente necesita atención 🙋',
        body: 'El asistente tuvo un problema y un cliente espera respuesta humana.',
        tag: 'escalation',
        data: { url: `/dashboard/conversaciones/${convId}` },
      })
    } catch (fallbackErr) {
      console.error('[agent] fallback error', fallbackErr)
    }
    return { handled: true, mode: 'sent', reply: FALLBACK_REPLY }
  }

  const approvalMode = ctx.config?.approval_mode ?? 'low_confidence'
  const needsApproval =
    approvalMode === 'always' || (approvalMode === 'low_confidence' && approvalRequested)

  // Confirmación estructurada determinista (fecha/hora exactas en tz de la
  // sucursal) cuando hubo acciones; el texto del modelo va antes, como cierre.
  const confirmations = actions
    .map((a) => buildConfirmation(a, tz, ctx.branch?.name ?? ''))
    .join('\n\n')
  const composed = [text, confirmations].filter(Boolean).join('\n\n')

  const reply = (approvalRequested ? approvalDraft : composed).trim()
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
    await notifyOrgOwners(ctx.org_id, {
      title: 'Respuesta esperando tu aprobación ✋',
      body: reply.slice(0, 120),
      tag: 'approval',
      data: { url: `/dashboard/conversaciones/${convId}` },
    })
    return { handled: true, mode: 'approval', reply }
  }

  // Si este turno OFRECIÓ horarios (y no cerró una acción), se envían como
  // botones de opción rápida; la pulsación vuelve como mensaje entrante.
  const useButtons =
    offeredSlots.length > 0 && actions.length === 0 && !!senders.sendButtons
  const extId = useButtons
    ? await senders.sendButtons!(reply, offeredSlots)
    : await senders.sendToCustomer(reply)
  await supabase.rpc('log_outbound_message', {
    p_conversation_id: convId,
    p_body: reply,
    p_sender: 'ai',
    p_external_id: extId ?? undefined,
  })
  return { handled: true, mode: 'sent', reply }
}
