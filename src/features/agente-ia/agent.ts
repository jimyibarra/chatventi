import { generateText, tool, stepCountIs } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyOrgOwners } from '@/features/notifications/send'
import { TRIAL_AI_MESSAGE_CAP } from '@/shared/security/limits'
import { renderVoiceBlock, resolveVoiceProfile } from './voice'
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
            `- ${a.services} — ${fmtDateTime(a.starts_at, tz)}${
              a.resource_name ? ` con ${a.resource_name}` : ''
            } (estado: ${a.status}, id: ${a.id})`
        )
        .join('\n')
    : '(sin citas próximas)'

  // Quién puede atender. service_ids vacío = presta TODOS los servicios.
  const resourceList = ctx.resources ?? []
  const resources = resourceList.length
    ? resourceList
        .map((r) => {
          const presta = r.service_ids.length
            ? r.service_ids
                .map((id) => ctx.services.find((s) => s.id === id)?.name ?? id)
                .join(', ')
            : 'todos los servicios'
          return `- ${r.name} — id: ${r.id} (presta: ${presta})`
        })
        .join('\n')
    : null

  // Voz de marca. Va ANTES de REGLAS IMPORTANTES y lleva su propia cláusula de
  // subordinación, pero la garantía real es que se compone de enums cerrados
  // (ver voice.ts): no hay texto libre que pueda leerse como instrucción.
  // Sin voz configurada, voiceBlock es null y el prompt queda idéntico al de
  // antes de esta feature.
  // ¿Hay en el historial algún archivo ya leído (visión/transcripción)?
  const hasReadFiles = ctx.messages.some((m) => (m.media_text ?? '').trim().length > 0)

  const voiceBlock = renderVoiceBlock(
    resolveVoiceProfile(ctx.config?.voice_preset, ctx.config?.voice_profile)
  )

  return [
    ctx.config?.system_prompt?.trim() ||
      'Eres el recepcionista virtual de un negocio de servicios. Ayudas a los clientes a agendar, reagendar o cancelar citas y respondes dudas sobre el negocio.',
    ...(voiceBlock ? ['', voiceBlock] : []),
    '',
    'REGLAS IMPORTANTES:',
    '- Responde SOLO sobre este negocio: sus servicios, citas, horarios y la información de la base de conocimiento. Si te preguntan algo ajeno al negocio, decláralo con amabilidad y redirige. Si el cliente insiste con temas ajenos por segunda vez consecutiva, usa request_human_approval.',
    // El tono estaba mezclado con la disciplina en esta línea. "UNA sola
    // pregunta por mensaje" ES disciplina y se queda siempre; "cálido y breve"
    // es tono y chocaría con un preset Formal, así que solo se mantiene cuando
    // NO hay voz configurada — así el prompt de quien no la use queda idéntico.
    voiceBlock
      ? '- Habla en español (es un chat de WhatsApp/Telegram). UNA sola pregunta por mensaje.'
      : '- Habla en español, con tono cálido y breve (es un chat de WhatsApp/Telegram). UNA sola pregunta por mensaje.',
    '- NUNCA re-preguntes datos que ya están en el historial (servicio, fecha, nombre): úsalos directamente.',
    '- Nombre del cliente: si ya lo conoces (aparece abajo), salúdalo por su nombre y NO lo vuelvas a pedir. Si NO lo conoces y el cliente lo comparte —o cuando estés por agendar—, guárdalo con save_client_name. Pídelo UNA sola vez, con amabilidad, y no insistas si prefiere no darlo.',
    '- Para agendar necesitas: el/los servicio(s) y una fecha. Usa la herramienta check_availability para ofrecer horarios reales; nunca inventes disponibilidad. Ofrece MÁXIMO 3 horarios por mensaje. Al llamar las herramientas, usa el id EXACTO del servicio (el uuid mostrado en la lista de servicios).',
    '- Confirma con el cliente antes de reservar. Reserva con book_appointment SOLO cuando el cliente eligió un horario concreto. Si el cliente ya fue explícito con servicio y horario, reserva directo sin re-preguntar.',
    '- 🔴 Si TÚ ofreciste una hora y el cliente acepta sin repetirla ("sí", "va", "perfecto"), eligió ESA hora, la de tu mensaje anterior. NO tomes otra de la lista de disponibilidad (ni la primera): reservar a una hora distinta de la pactada hace que el cliente se presente cuando no le toca.',
    '- En book_appointment y reschedule_appointment, `hora_ofrecida` es la hora que le dijiste al cliente, copiada tal cual de tu mensaje (ej. "16:30" o "4:30 pm"). Es la que manda: si no coincide con el instante que pasas, el sistema reserva la que prometiste.',
    '- Si el mensaje del cliente contiene una marca [slot:<instante>], eligió ese horario: pasa a book_appointment/reschedule_appointment el instante EXACTO que sigue a "slot:" sin modificarlo.',
    '- Si la marca es [slot:<instante>|<uuid>], el uuid tras la barra es el resource_id de ESE horario: pásalo tal cual a book_appointment. No lo omitas ni lo cambies, o reservarías con otra persona.',
    ...(resources
      ? [
          '- Si el cliente pide a alguien concreto, pasa su resource_id a check_availability y a book_appointment. Si NO lo pide y hay varias personas que prestan el servicio, pregunta con quién UNA sola vez; si le da igual, omite resource_id y el sistema asigna a quien esté libre.',
          '- NUNCA ofrezcas a alguien que no preste el servicio pedido (mira la lista de quién presta qué).',
        ]
      : []),
    '- Si vas a reservar y NO tienes el instante ISO exacto (devuelto por check_availability en este turno o en una marca [slot:...]), vuelve a llamar check_availability y usa el ISO cuya hora coincida con la que pidió el cliente. NUNCA construyas el instante tú mismo.',
    '- Para CANCELAR o REAGENDAR usa cancel_appointment / reschedule_appointment con el id EXACTO de la lista CITAS PRÓXIMAS DEL CLIENTE. Si tiene varias citas, pregunta cuál UNA sola vez. Si no tiene citas próximas, dilo con amabilidad. Para reagendar, primero consulta disponibilidad con check_availability.',
    '- Si el cliente cambia de opinión a mitad del proceso, simplemente continúa con lo nuevo; no lo hagas repetir todo.',
    '- Cuando una herramienta de reservar/cancelar/reagendar tenga ÉXITO, tu texto final debe ser UNA frase corta y cálida SIN repetir fecha ni hora (el sistema envía la confirmación exacta por ti).',
    '- Si no puedes resolver algo o hay una queja/caso delicado, usa request_human_approval con un borrador de respuesta para que un humano lo revise.',
    // Solo cuando de verdad hay un archivo leído en el historial. Sin esto el
    // agente trataba la lectura como algo "fuera de su ámbito" y respondía
    // "no puedo ayudarte con eso" a un comprobante de pago perfectamente
    // legible: la capacidad de visión no sirve de nada si no se le dice qué
    // hacer con lo que ve. Con las capacidades apagadas el prompt es idéntico
    // al de siempre, que es el criterio de toda esta línea de trabajo.
    ...(hasReadFiles
      ? [
          '- ARCHIVOS DEL CLIENTE: cuando un mensaje traiga "(contenido del archivo: ...)", eso es la lectura de una foto o la transcripción de una nota de voz que te envió el cliente. Trátalo EXACTAMENTE como si te lo hubiera escrito él, y NUNCA digas que no puedes ver imágenes ni escuchar audios.',
          '- Si es un comprobante de pago, agradécelo, confirma en la MISMA frase el monto y la fecha que aparecen, y continúa con lo que estaba pendiente. Si el comprobante no cuadra con lo esperado, o falta un dato clave, dilo con amabilidad y usa request_human_approval en vez de dar el pago por bueno.',
        ]
      : []),
    `- Hoy es ${today} (zona horaria ${tz}).`,
    '',
    `NOMBRE DEL CLIENTE: ${ctx.conversation?.client_name?.trim() || '(desconocido)'}`,
    '',
    `SERVICIOS DEL NEGOCIO${ctx.branch ? ` (sucursal ${ctx.branch.name})` : ''}:`,
    services,
    '',
    ...(resources ? ['QUIÉN ATIENDE (usa el id EXACTO al llamar las herramientas):', resources, ''] : []),
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
// Cuando el mensaje traía un archivo leído (visión o transcripción), lo que
// entra al historial es lo que el archivo DICE: con el placeholder "[image]"
// a secas el modelo no tiene nada a lo que responder.
function toModelMessages(ctx: AgentContext) {
  return ctx.messages
    .map((m) => {
      const body = (m.body ?? '').trim()
      const read = (m.media_text ?? '').trim()
      const content = read ? `${body} (contenido del archivo: ${read})`.trim() : body
      return {
        role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content,
      }
    })
    .filter((m) => m.content.length > 0)
}

// Red de seguridad de zona horaria: si el modelo pasa un instante SIN offset
// (p.ej. "2026-07-12T16:30:00"), se interpreta como hora LOCAL de la sucursal
// y se convierte a UTC. Con offset explícito se respeta tal cual.
function isoWithTz(input: string, tz: string): string {
  const s = input.trim()
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) return s
  const guess = new Date(`${s}Z`)
  if (Number.isNaN(guess.getTime())) return s
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(guess)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  const localAtGuess = Date.parse(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`
  )
  const offsetMs = localAtGuess - guess.getTime()
  return new Date(guess.getTime() - offsetMs).toISOString()
}

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

// Minutos desde medianoche de "16:30", "4:30 pm", "16 h", "4pm"…
// Devuelve null si no se reconoce; quien llama NO debe bloquear en ese caso
// (ver la comprobación de book_appointment).
function parseHoraHumana(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\./g, '')
  const m = s.match(/(\d{1,2})(?:[:h\s](\d{2}))?\s*(am|pm)?/)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  return h * 60 + min
}

/**
 * Red de seguridad contra "confirmo una hora distinta a la pactada".
 *
 * `check_availability` devuelve hasta 3 horarios; se observó (2026-08-05) que
 * tras ofrecer uno —"a las 16:30"— y recibir un "sí, resérvalo", el modelo
 * reservaba el PRIMERO del array. El cliente se presenta a otra hora y la culpa
 * es del negocio.
 *
 * Se obliga al modelo a declarar la hora que le dijo al cliente y, si no cuadra
 * con el instante que iba a grabar, **se corrige aquí**, en el código.
 *
 * Por qué corregir y no rechazar: la primera versión devolvía un error para que
 * el modelo reintentara, y el modelo respondió al cliente "las 4:30 no están
 * disponibles" —falso— y le ofreció otras horas. Delegar la recuperación en el
 * modelo reintroduce el mismo problema por otra puerta. Corrigiendo, el cliente
 * recibe SIEMPRE lo que se le prometió; y si ese hueco ya está ocupado, la RPC
 * de reserva lo rechaza con `slot_taken`, que el agente ya sabe manejar.
 *
 * Si la hora declarada no se puede interpretar, se deja el instante tal cual:
 * es una red de coherencia, no una guarda de acceso, y tumbar una reserva
 * legítima por un fallo del parser sería peor que el problema que evita.
 */
function conHoraPactada(startsAtUtc: string, horaOfrecida: string, tz: string): string {
  const prometida = parseHoraHumana(horaOfrecida)
  const real = parseHoraHumana(fmtTime(startsAtUtc, tz))
  if (prometida === null || real === null || prometida === real) return startsAtUtc

  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startsAtUtc))
  const hh = String(Math.floor(prometida / 60)).padStart(2, '0')
  const mm = String(prometida % 60).padStart(2, '0')
  const corregido = isoWithTz(`${ymd}T${hh}:${mm}:00`, tz)

  console.warn(
    `[agente] la hora pactada no coincidía: dijo "${horaOfrecida}" e iba a reservar ` +
      `${fmtTime(startsAtUtc, tz)}; se corrige a ${fmtTime(corregido, tz)}`
  )
  return corregido
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
  | {
      kind: 'booked'
      services: string
      startsAt: string
      manageUrl?: string | null
      resourceName?: string | null
    }
  | {
      kind: 'rescheduled'
      services: string
      startsAt: string
      manageUrl?: string | null
      resourceName?: string | null
    }
  | { kind: 'cancelled'; services: string; startsAt: string }

function buildConfirmation(action: ChatAction, tz: string, branchName: string): string {
  const when = fmtDateTime(action.startsAt, tz)
  // Enlace mágico (Ola 2): el cliente gestiona su cita sin login.
  const link =
    action.kind !== 'cancelled' && action.manageUrl
      ? `\n🔗 Gestiona tu cita aquí: ${action.manageUrl}`
      : ''
  // Con quién es la cita. Solo aparece si el negocio tiene profesionales.
  const who =
    action.kind !== 'cancelled' && action.resourceName ? `\n👤 Con ${action.resourceName}` : ''
  switch (action.kind) {
    case 'booked':
      return `✅ *Cita confirmada*\n📅 ${when}\n🔹 ${action.services}${who}\n📍 ${branchName}${link}`
    case 'rescheduled':
      return `🔄 *Cita reagendada*\n📅 Nueva fecha: ${when}\n🔹 ${action.services}${who}\n📍 ${branchName}${link}`
    case 'cancelled':
      return `❌ *Cita cancelada*\n📅 Era: ${when}\n🔹 ${action.services}`
  }
}

// Nombre del profesional asignado a una cita (o null). El motor puede haberlo
// elegido solo con "el que sea", así que se relee tras reservar/reagendar.
//
// Usa el SERVICE client a propósito: en el webhook el cliente es ANON y las
// políticas RLS de `appointments` piden get_my_org(), que para anon es null.
// Leerlo con el cliente del agente devolvería null en silencio y la
// confirmación jamás diría con quién es la cita. (Gotcha del PRP.)
// Nunca rompe la reserva: si falla, se omite el nombre.
async function fetchResourceName(appointmentId: string): Promise<string | null> {
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('appointments')
      .select('resource:resources(name)')
      .eq('id', appointmentId)
      .maybeSingle()
    const resource = (data as { resource: { name: string } | null } | null)?.resource
    return resource?.name ?? null
  } catch (e) {
    console.error('[agent] fetchResourceName error', e)
    return null
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

// Se alcanzó el tope de mensajes de IA de la prueba gratis. Lo lee el CLIENTE
// final del negocio, no el dueño: no puede sonar a error ni a reproche, y
// tiene que dejarle una salida (una persona le atenderá).
const TRIAL_CAP_REPLY =
  'Gracias por escribir 🙏 En este momento no puedo responderte de forma automática, pero ya avisé al equipo para que te atienda personalmente en cuanto pueda.'

// -------------------------------------------------------------------
// Orquestador: obtiene contexto, corre el LLM con herramientas y decide
// enviar directo o enrutar a aprobación humana.
// -------------------------------------------------------------------
export async function runAgent(params: {
  channelType: 'whatsapp' | 'telegram' | 'web'
  externalId: string
  fromHandle: string
  supabase: AnyClient
  senders: AgentSenders
  // Modo prueba del dashboard (/dashboard/agente/probar): corre contra el
  // contexto REAL de la org pero con CERO efectos secundarios. Salta los gates
  // (habilitación/pausa/billing), SIMULA las escrituras (reservar/cancelar/
  // reagendar no tocan la BD) y no crea aprobaciones ni notifica a los dueños.
  // Aditivo: los llamadores existentes (webhooks WA/TG, /api/demo-chat) no lo pasan.
  sandbox?: boolean
}): Promise<RunAgentResult> {
  const { channelType, externalId, fromHandle, supabase, senders } = params
  const sandbox = params.sandbox ?? false

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { handled: false, reason: 'sin OPENROUTER_API_KEY' }

  const { data: ctxData, error: ctxErr } = await supabase.rpc('get_agent_context', {
    p_channel_type: channelType,
    p_external_id: externalId,
    p_from_handle: fromHandle,
  })
  if (ctxErr || !ctxData) return { handled: false, reason: 'sin contexto' }

  const ctx = ctxData as unknown as AgentContext
  // En sandbox respondemos aunque el agente esté apagado/pausado: es una prueba,
  // no atención real. (should_respond depende de agent_configs.enabled.)
  if (!sandbox && !ctx.conversation?.should_respond) {
    return { handled: false, reason: 'no debe responder (pausa/desactivado/pendiente)' }
  }
  if (!ctx.branch) return { handled: false, reason: 'sin sucursal' }

  // Gating del módulo IA: con el cobro activo, la org debe tener el módulo
  // Recepcionista IA vigente (trial/activo). Con BILLING_ENFORCED apagado no
  // bloquea nada (rollout suave). Se consulta con service_role (el cliente del
  // webhook es anon y no puede ejecutar org_has_ai). En sandbox no se cobra.
  if (!sandbox && process.env.BILLING_ENFORCED === 'true') {
    try {
      const admin = createServiceClient()
      const { data: hasAi } = await admin.rpc('org_has_ai', { p_org: ctx.org_id })
      if (!hasAi) return { handled: false, reason: 'módulo IA no contratado' }
    } catch (e) {
      console.error('[agent] gating IA error', e)
    }
  }

  // Tope de consumo de IA durante la prueba gratis (2026-08-04). Protege la
  // factura de OpenRouter: sin esto, una cuenta en prueba puede gastar sin
  // límite y reciclar cuentas sale gratis.
  //
  // 🔴 Falla ABIERTO a propósito, al revés que los gates del registro. Aquí
  // no se protege un acceso, se acota un coste: si la consulta falla, el
  // daño de callar al agente ante un cliente final REAL de un negocio que
  // paga es mucho mayor que el de unos tokens de más. La decisión es
  // deliberada, no un descuido.
  if (!sandbox) {
    try {
      const admin = createServiceClient()
      const { data: capData } = await admin.rpc('consume_trial_ai_message', {
        p_org: ctx.org_id,
        p_cap: TRIAL_AI_MESSAGE_CAP,
      })
      const cap = capData as { allowed?: boolean } | null
      if (cap && cap.allowed === false) {
        // Se responde igualmente (el cliente nunca se queda en silencio) pero
        // sin llamar al modelo: ahí está el ahorro. El mensaje se registra en
        // la conversación como cualquier otro saliente, para que el dueño lo
        // vea en su bandeja y entienda qué pasó.
        const extId = await senders.sendToCustomer(TRIAL_CAP_REPLY)
        if (ctx.conversation?.id) {
          await supabase.rpc('log_outbound_message', {
            p_conversation_id: ctx.conversation.id,
            p_body: TRIAL_CAP_REPLY,
            p_sender: 'ai',
            p_external_id: extId ?? undefined,
          })
        }
        return { handled: true, mode: 'sent', reply: TRIAL_CAP_REPLY }
      }
    } catch (e) {
      console.error('[agent] tope de prueba: no se pudo consultar', e)
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
        'Consulta los horarios disponibles para uno o más servicios en una fecha. Devuelve horas libres reales (máx 3). Pasa resource_id solo si el cliente pidió a alguien concreto.',
      inputSchema: z.object({
        service_ids: z.array(z.string().uuid()).min(1),
        date: z.string().describe('Fecha en formato YYYY-MM-DD'),
        resource_id: z
          .string()
          .uuid()
          .optional()
          .describe('Id de la persona/recurso, solo si el cliente pidió a alguien concreto'),
      }),
      execute: async ({ service_ids, date, resource_id }) => {
        const { data, error } = await supabase.rpc('get_available_slots_v2', {
          p_branch_id: branchId,
          p_service_ids: service_ids,
          p_date: date,
          p_resource_id: resource_id,
        })
        if (error) return { error: 'No pude consultar disponibilidad.' }
        const all = (data ?? []) as { slot_start: string; resource_id: string | null }[]

        // Sin recurso pedido, el mismo instante llega una vez por persona libre:
        // se ofrece la hora UNA vez y el motor asigna a quien esté libre al reservar.
        const slots = resource_id
          ? all
          : all.filter((s, i, xs) => xs.findIndex((o) => o.slot_start === s.slot_start) === i)

        if (slots.length === 0) return { available: [], note: 'Sin horarios ese día.' }
        // Máx 3 horarios por mensaje (anti-fatiga): mañana / mediodía / tarde
        // cuando hay muchos, para dar opciones repartidas del día.
        const pick =
          slots.length <= 3
            ? slots
            : [slots[0], slots[Math.floor(slots.length / 2)], slots[slots.length - 1]]
        const times = pick.map((s) => fmtTime(s.slot_start, tz))
        // Botones de opción rápida. La marca lleva el recurso SOLO si el cliente
        // pidió a alguien: si no, reservar sin recurso deja que el motor elija.
        offeredSlots = pick.map((s) => ({
          id: resource_id ? `slot:${s.slot_start}|${resource_id}` : `slot:${s.slot_start}`,
          title: fmtTime(s.slot_start, tz),
        }))
        return {
          date,
          available_times: times,
          iso: pick.map((s) => s.slot_start),
          resource_id: resource_id ?? null,
        }
      },
    }),
    book_appointment: tool({
      description:
        'Agenda una cita para el cliente actual. Úsalo solo cuando el cliente confirmó servicio(s) y un horario concreto (usa el valor ISO devuelto por check_availability). Pasa resource_id si el cliente eligió a alguien; omítelo si le da igual.',
      inputSchema: z.object({
        service_ids: z.array(z.string().uuid()).min(1),
        starts_at: z.string().describe('Instante ISO 8601 del inicio (de check_availability)'),
        hora_ofrecida: z
          .string()
          .describe(
            'La hora EXACTA que le dijiste al cliente en la conversación, tal cual (ej. "16:30" o "4:30 pm"). Debe corresponder a starts_at.'
          ),
        resource_id: z
          .string()
          .uuid()
          .optional()
          .describe('Id de la persona elegida (o el uuid tras la barra de la marca [slot:...|uuid])'),
      }),
      execute: async ({ service_ids, starts_at, hora_ofrecida, resource_id }) => {
        const startsAtUtc = conHoraPactada(isoWithTz(starts_at, tz), hora_ofrecida, tz)
        // Sandbox: NO se crea la cita; solo se arma la confirmación (misma UI).
        if (sandbox) {
          const resourceName = resource_id
            ? (ctx.resources?.find((r) => r.id === resource_id)?.name ?? null)
            : null
          actions.push({
            kind: 'booked',
            services: serviceNames(service_ids),
            startsAt: startsAtUtc,
            manageUrl: null,
            resourceName,
          })
          return { ok: true, appointment_id: 'sandbox', confirmed_at: fmtTime(startsAtUtc, tz), with: resourceName }
        }
        const { data, error } = await supabase.rpc('create_appointment_from_chat_v2', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_service_ids: service_ids,
          p_starts_at: startsAtUtc,
          p_resource_id: resource_id,
        })
        if (error) {
          if (error.message.includes('slot_taken'))
            return { ok: false, error: 'Ese horario acaba de ocuparse. Ofrece otro.' }
          if (error.message.includes('no_resource_available'))
            return { ok: false, error: 'Nadie está libre a esa hora para ese servicio. Ofrece otro horario.' }
          if (error.message.includes('resource_not_found'))
            return { ok: false, error: 'Esa persona ya no está disponible. Vuelve a consultar quién atiende.' }
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
        // El motor pudo asignar a alguien aunque no se pidiera ("el que sea"):
        // se relee para que la confirmación diga con quién es la cita.
        const resourceName = data ? await fetchResourceName(String(data)) : null
        actions.push({
          kind: 'booked',
          services: serviceNames(service_ids),
          startsAt: startsAtUtc,
          manageUrl,
          resourceName,
        })
        return {
          ok: true,
          appointment_id: data,
          confirmed_at: fmtTime(startsAtUtc, tz),
          with: resourceName,
        }
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
        // Sandbox: cancelación simulada (no toca la BD).
        if (sandbox) {
          actions.push({ kind: 'cancelled', services: appt.services, startsAt: appt.starts_at })
          return { ok: true }
        }
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
        hora_ofrecida: z
          .string()
          .describe(
            'La hora EXACTA que le dijiste al cliente en la conversación, tal cual (ej. "16:30" o "4:30 pm"). Debe corresponder a new_starts_at.'
          ),
      }),
      execute: async ({ appointment_id, new_starts_at, hora_ofrecida }) => {
        const appt = upcomingById(appointment_id)
        if (!appt) return { ok: false, error: 'Esa cita no está en la lista del cliente.' }
        const newStartsAtUtc = conHoraPactada(isoWithTz(new_starts_at, tz), hora_ofrecida, tz)
        // Sandbox: reagenda simulada (no toca la BD).
        if (sandbox) {
          actions.push({
            kind: 'rescheduled',
            services: appt.services,
            startsAt: newStartsAtUtc,
            manageUrl: null,
            resourceName: appt.resource_name ?? null,
          })
          return { ok: true, confirmed_at: fmtTime(newStartsAtUtc, tz) }
        }
        const { error } = await supabase.rpc('reschedule_appointment_from_chat', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_appointment_id: appointment_id,
          p_new_starts_at: newStartsAtUtc,
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
          startsAt: newStartsAtUtc,
          manageUrl,
          resourceName: await fetchResourceName(appointment_id),
        })
        return { ok: true, confirmed_at: fmtTime(newStartsAtUtc, tz) }
      },
    }),
    save_client_name: tool({
      description:
        'Guarda el nombre del cliente en su ficha cuando lo comparte, para personalizar la atención y que el negocio lo identifique. Úsalo en cuanto sepas su nombre; no lo uses para otros datos.',
      inputSchema: z.object({
        name: z.string().min(1).describe('Nombre del cliente tal como lo dio'),
      }),
      execute: async ({ name }) => {
        const { error } = await supabase.rpc('set_client_name_from_chat', {
          p_channel_type: channelType,
          p_external_id: externalId,
          p_client_phone: fromHandle,
          p_name: name,
        })
        if (error) return { ok: false }
        return { ok: true, saved: name }
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
    // En sandbox no escalamos ni notificamos: solo devolvemos el fallback.
    if (sandbox) return { handled: true, mode: 'sent', reply: FALLBACK_REPLY }
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
  // En sandbox nunca se crea aprobación ni se notifica a los dueños: el dueño
  // solo quiere ver la respuesta. Se envía el borrador tal cual (más abajo).
  const needsApproval =
    !sandbox &&
    (approvalMode === 'always' || (approvalMode === 'low_confidence' && approvalRequested))

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
