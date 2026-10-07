// =====================================================================
// ChatVenti · Plantillas de WhatsApp
//
//   POR QUÉ EXISTEN: Meta solo entrega texto libre si el cliente escribió en
//   las últimas 24 h. Un recordatorio de una cita agendada hace tres días cae
//   FUERA de esa ventana y Meta lo rechaza (#131047). Lo único que cruza la
//   ventana es una plantilla aprobada. Sin esto, los recordatorios solo le
//   llegaban a quien había agendado el mismo día.
//
//   Las plantillas viven en la cuenta de WhatsApp (WABA) de CADA negocio, así
//   que se crean por API al conectar el canal, desde /admin/plantillas o
//   Conexiones («Pedir las que faltan») y, por si acaso, la primera vez que un
//   envío responde "esa plantilla no existe".
//
//   Cada plantilla es de UN mensaje automático: el código que lo manda llena
//   sus variables ({{1}}, {{2}}…). Por eso el catálogo vive aquí y no en una
//   tabla: una plantilla sin código que la envíe no serviría de nada.
//
//   🔴 Cambiar el texto de una plantilla = plantilla NUEVA (sube el sufijo
//   _vN): Meta no deja editar el cuerpo de una ya aprobada sin re-revisión.
// =====================================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const GRAPH = 'https://graph.facebook.com/v25.0'
const LANG = 'es_MX'
/** Base del enlace «Cambiar o cancelar»; los negocios de un socio con dominio propio usan el suyo. */
export const MANAGE_BASE = 'https://www.chatventi.com/c/'

export type WaTemplateKey =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'followup'
  | 'followup_csat'
  | 'cold_followup'
  | 'client_reminder'

type Button =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example: string[] }

type TemplateDef = {
  name: string
  /** UTILITY: aviso de algo que el cliente ya pidió. MARKETING: invitar a volver (Meta lo cobra más caro, al negocio). */
  category: 'UTILITY' | 'MARKETING'
  /** Para qué la usa ChatVenti, en palabras del dueño. */
  label: string
  /** Encabezado corto para tablas. */
  short: string
  body: string
  example: string[]
  buttons?: Button[]
}

const templatesFor = (manageBase: string): Record<WaTemplateKey, TemplateDef> => ({
  reminder_24h: {
    name: 'cv_recordatorio_cita_v1',
    category: 'UTILITY',
    label: 'Recordatorio un día antes, con «Confirmar asistencia»',
    short: 'Un día antes',
    body: 'Hola {{1}}, te recordamos tu cita en {{2}} el {{3}}. Servicio: {{4}}. ¡Te esperamos!',
    example: ['Ana', 'Estética Lumen', 'mar 7 oct, 16:00', 'Corte de cabello'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar asistencia' },
      { type: 'URL', text: 'Cambiar o cancelar', url: `${manageBase}{{1}}`, example: [`${manageBase}ejemplo`] },
    ],
  },
  reminder_2h: {
    name: 'cv_recordatorio_hoy_v1',
    category: 'UTILITY',
    label: 'Recordatorio el mismo día',
    short: 'El mismo día',
    body: 'Hola {{1}}, tu cita en {{2}} es hoy a las {{3}}. Servicio: {{4}}. ¡Te esperamos!',
    example: ['Ana', 'Estética Lumen', '16:00', 'Corte de cabello'],
  },
  followup: {
    name: 'cv_seguimiento_visita_v1',
    category: 'UTILITY',
    label: 'Seguimiento después de la visita',
    short: 'Seguimiento',
    body: 'Hola {{1}}, gracias por tu visita a {{2}}. ¿Cómo estuvo tu experiencia? Respóndenos por aquí, tu opinión nos ayuda a mejorar.',
    example: ['Ana', 'Estética Lumen'],
  },
  followup_csat: {
    name: 'cv_encuesta_visita_v1',
    category: 'UTILITY',
    label: 'Encuesta después de la visita (Excelente, Bien, Mal)',
    short: 'Encuesta',
    body: 'Hola {{1}}, gracias por tu visita a {{2}}. ¿Cómo estuvo tu experiencia? Toca una opción, tu opinión nos ayuda a mejorar.',
    example: ['Ana', 'Estética Lumen'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Excelente' },
      { type: 'QUICK_REPLY', text: 'Bien' },
      { type: 'QUICK_REPLY', text: 'Mal' },
    ],
  },
  // Sin estas dos, el rescate de interesados y los recordatorios del expediente
  // salían como texto libre: siempre fuera de las 24 h, Meta los rechazaba.
  cold_followup: {
    name: 'cv_rescate_interes_v1',
    category: 'MARKETING',
    label: 'Rescate de interesados que no agendaron',
    short: 'Rescate',
    body: 'Hola {{1}}, te escribimos de {{2}}. Vimos que quedó pendiente tu consulta. Si quieres, te apartamos un lugar: dinos qué día te viene bien y lo agendamos.',
    example: ['Ana', 'Estética Lumen'],
  },
  client_reminder: {
    name: 'cv_recordatorio_cliente_v1',
    category: 'MARKETING',
    label: 'Recordatorios recurrentes del expediente («ya toca tu limpieza»)',
    short: 'Expediente',
    body: 'Hola {{1}}, te escribimos de {{2}} con un recordatorio:\n\n{{3}}\n\nResponde a este mensaje y te ayudamos a agendar.',
    example: ['Ana', 'Clínica Dental Sonríe', 'Ya te toca tu limpieza dental de cada 6 meses.'],
  },
})

const TEMPLATES = templatesFor(MANAGE_BASE)

/** Catálogo para las pantallas: qué plantilla usa cada mensaje automático. */
export const WA_TEMPLATES = (Object.keys(TEMPLATES) as WaTemplateKey[]).map((key) => ({ key, ...TEMPLATES[key] }))

/**
 * Token para administrar plantillas: el del System User de nuestro Tech
 * Provider (permanente) y, de respaldo, el del negocio. Mismo orden que el
 * Embedded Signup.
 */
export function managementTokens(channelToken: string | null | undefined): string[] {
  return [process.env.META_SYSTEM_USER_TOKEN?.trim(), channelToken ?? undefined].filter((t): t is string => !!t)
}

export type MetaTemplate = { status: string; reason: string | null }
export type TemplateList = { ok: true; byName: Map<string, MetaTemplate>; token: string } | { ok: false; error: string }

/** Plantillas que la cuenta de WhatsApp ya tiene en Meta, con su estado. Prueba cada token en orden. */
export async function listWaTemplates(wabaId: string, tokens: string[]): Promise<TemplateList> {
  let error = 'Sin token para consultar Meta.'
  for (const token of tokens) {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates?fields=name,status,rejected_reason&limit=200`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as
      | { data?: { name: string; status: string; rejected_reason?: string }[]; error?: { message?: string } }
      | null
    if (res?.ok && json?.data) {
      const byName = new Map(json.data.map((t) => [t.name, { status: t.status, reason: t.rejected_reason ?? null }]))
      return { ok: true, byName, token }
    }
    error = json?.error?.message ?? `Meta respondió ${res?.status ?? 'sin conexión'}`
  }
  return { ok: false, error }
}

export type EnsureResult = { created: string[]; failed: { name: string; error: string }[]; error?: string }

/**
 * Crea en la cuenta de WhatsApp del negocio las plantillas que aún no existan.
 * Idempotente: se puede llamar las veces que haga falta. Las creadas quedan
 * «en revisión» unos minutos antes de poder usarse.
 */
export async function ensureWaTemplates(wabaId: string, token: string | string[], manageBase: string = MANAGE_BASE): Promise<EnsureResult> {
  const list = await listWaTemplates(wabaId, Array.isArray(token) ? token : [token])
  if (!list.ok) {
    console.error('[wa-templates] no se pudo listar', list.error)
    return { created: [], failed: [], error: list.error }
  }
  const headers = { authorization: `Bearer ${list.token}`, 'content-type': 'application/json' }
  const out: EnsureResult = { created: [], failed: [] }
  for (const t of Object.values(templatesFor(manageBase))) {
    if (list.byName.has(t.name)) continue
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: t.name,
        language: LANG,
        category: t.category,
        components: [
          { type: 'BODY', text: t.body, example: { body_text: [t.example] } },
          ...(t.buttons ? [{ type: 'BUTTONS', buttons: t.buttons }] : []),
        ],
      }),
    })
    if (res.ok) {
      out.created.push(t.name)
      continue
    }
    const json = (await res.json().catch(() => null)) as { error?: { error_user_msg?: string; message?: string } } | null
    const error = json?.error?.error_user_msg ?? json?.error?.message ?? `Meta respondió ${res.status}`
    console.error(`[wa-templates] no se pudo crear ${t.name}`, error)
    out.failed.push({ name: t.name, error })
  }
  return out
}

// Meta rechaza parámetros vacíos, con saltos de línea o con 4+ espacios seguidos.
function param(value: string | null | undefined, fallback: string, max = 120): { type: 'text'; text: string } {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim()
  return { type: 'text', text: (clean || fallback).slice(0, max) }
}

async function getWaChannel(
  service: SupabaseClient<Database>,
  phoneNumberId: string
): Promise<{ token: string; wabaId: string | null } | null> {
  const { data } = await service
    .from('channels')
    .select('credentials, waba_id')
    .eq('type', 'whatsapp')
    .eq('external_id', phoneNumberId)
    .maybeSingle()
  const token = (data?.credentials as { access_token?: string } | null)?.access_token
  return token ? { token, wabaId: data?.waba_id ?? null } : null
}

export interface WaTemplateData {
  clientName: string | null
  orgName: string
  /** Fecha/hora ya formateada en la zona del negocio (recordatorios). */
  when?: string
  serviceNames?: string | null
  /** Botones de confirmar y de encuesta (recordatorio 24 h y encuesta). */
  appointmentId?: string
  manageToken?: string | null
  /** Texto que el dueño escribió para un recordatorio recurrente. */
  note?: string | null
}

function bodyParams(key: WaTemplateKey, d: WaTemplateData) {
  const name = param(d.clientName?.trim().split(/\s+/)[0], 'qué tal')
  const org = param(d.orgName, 'nuestro negocio')
  if (key === 'reminder_24h' || key === 'reminder_2h') {
    return [name, org, param(d.when, 'la hora acordada'), param(d.serviceNames, 'tu cita')]
  }
  if (key === 'client_reminder') return [name, org, param(d.note, 'es momento de agendar tu próxima visita', 600)]
  return [name, org]
}

function buttonParams(key: WaTemplateKey, d: WaTemplateData) {
  const payload = (id: string, index: number) => ({
    type: 'button',
    sub_type: 'quick_reply',
    index: String(index),
    parameters: [{ type: 'payload', payload: id }],
  })
  if (key === 'reminder_24h') {
    return [
      payload(`conf:${d.appointmentId ?? ''}`, 0),
      { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: d.manageToken ?? '' }] },
    ]
  }
  if (key === 'followup_csat') return [5, 3, 1].map((score, i) => payload(`csat:${d.appointmentId ?? ''}:${score}`, i))
  return []
}

/**
 * Envía una plantilla. Devuelve el id del mensaje, o null si Meta la rechazó
 * (pendiente de aprobación, inexistente, número inválido…): quien llama cae
 * entonces al texto libre, que sí funciona dentro de la ventana de 24 h.
 */
export async function waSendTemplate(
  service: SupabaseClient<Database>,
  phoneNumberId: string,
  to: string,
  key: WaTemplateKey,
  d: WaTemplateData
): Promise<string | null> {
  const channel = await getWaChannel(service, phoneNumberId)
  if (!channel) return null
  const t = TEMPLATES[key]

  // México: Cloud API espera 52XXXXXXXXXX (mismo criterio que waSendMessage).
  const dest = /^521\d{10}$/.test(to) ? `52${to.slice(3)}` : /^\d{10}$/.test(to) ? `52${to}` : to

  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${channel.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: dest,
      type: 'template',
      template: {
        name: t.name,
        language: { code: LANG },
        components: [{ type: 'body', parameters: bodyParams(key, d) }, ...buttonParams(key, d)],
      },
    }),
  })
  const json = (await res.json().catch(() => null)) as
    | { messages?: { id: string }[]; error?: { code?: number; message?: string } }
    | null
  if (res.ok) return json?.messages?.[0]?.id ?? null

  console.error(`[wa-templates] ${t.name} rechazada`, json?.error?.code, json?.error?.message)
  // 132001 = la plantilla no existe en esta cuenta: se crea para la próxima.
  if (json?.error?.code === 132001 && channel.wabaId) {
    await ensureWaTemplates(channel.wabaId, managementTokens(channel.token)).catch(() => null)
  }
  return null
}
