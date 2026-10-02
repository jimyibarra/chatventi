// =====================================================================
// ChatVenti · Plantillas de WhatsApp (categoría UTILITY)
//
//   POR QUÉ EXISTEN: Meta solo entrega texto libre si el cliente escribió en
//   las últimas 24 h. Un recordatorio de una cita agendada hace tres días cae
//   FUERA de esa ventana y Meta lo rechaza (#131047). Lo único que cruza la
//   ventana es una plantilla aprobada. Sin esto, los recordatorios solo le
//   llegaban a quien había agendado el mismo día.
//
//   Las plantillas viven en la cuenta de WhatsApp (WABA) de CADA negocio, así
//   que se crean por API al conectar el canal y, por si acaso, la primera vez
//   que un envío responde "esa plantilla no existe".
//
//   🔴 Cambiar el texto de una plantilla = plantilla NUEVA (sube el sufijo
//   _vN): Meta no deja editar el cuerpo de una ya aprobada sin re-revisión.
// =====================================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const GRAPH = 'https://graph.facebook.com/v25.0'
const LANG = 'es_MX'
const MANAGE_BASE = 'https://www.chatventi.com/c/'

export type WaTemplateKey = 'reminder_24h' | 'reminder_2h' | 'followup' | 'followup_csat'

type Button =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example: string[] }

const TEMPLATES: Record<WaTemplateKey, { name: string; body: string; example: string[]; buttons?: Button[] }> = {
  reminder_24h: {
    name: 'cv_recordatorio_cita_v1',
    body: 'Hola {{1}}, te recordamos tu cita en {{2}} el {{3}}. Servicio: {{4}}. ¡Te esperamos!',
    example: ['Ana', 'Estética Lumen', 'mar 7 oct, 16:00', 'Corte de cabello'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar asistencia' },
      { type: 'URL', text: 'Cambiar o cancelar', url: `${MANAGE_BASE}{{1}}`, example: [`${MANAGE_BASE}ejemplo`] },
    ],
  },
  reminder_2h: {
    name: 'cv_recordatorio_hoy_v1',
    body: 'Hola {{1}}, tu cita en {{2}} es hoy a las {{3}}. Servicio: {{4}}. ¡Te esperamos!',
    example: ['Ana', 'Estética Lumen', '16:00', 'Corte de cabello'],
  },
  followup: {
    name: 'cv_seguimiento_visita_v1',
    body: 'Hola {{1}}, gracias por tu visita a {{2}}. ¿Cómo estuvo tu experiencia? Respóndenos por aquí, tu opinión nos ayuda a mejorar.',
    example: ['Ana', 'Estética Lumen'],
  },
  followup_csat: {
    name: 'cv_encuesta_visita_v1',
    body: 'Hola {{1}}, gracias por tu visita a {{2}}. ¿Cómo estuvo tu experiencia? Toca una opción, tu opinión nos ayuda a mejorar.',
    example: ['Ana', 'Estética Lumen'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Excelente' },
      { type: 'QUICK_REPLY', text: 'Bien' },
      { type: 'QUICK_REPLY', text: 'Mal' },
    ],
  },
}

// Meta rechaza parámetros vacíos, con saltos de línea o con 4+ espacios seguidos.
function param(value: string | null | undefined, fallback: string): { type: 'text'; text: string } {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim()
  return { type: 'text', text: (clean || fallback).slice(0, 120) }
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

/**
 * Crea en la cuenta de WhatsApp del negocio las plantillas que aún no existan.
 * Idempotente: se puede llamar las veces que haga falta. Devuelve los nombres
 * recién creados (quedan "en revisión" unos minutos antes de poder usarse).
 */
export async function ensureWaTemplates(wabaId: string, token: string): Promise<string[]> {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const listRes = await fetch(`${GRAPH}/${wabaId}/message_templates?fields=name&limit=200`, { headers })
  if (!listRes.ok) {
    console.error('[wa-templates] no se pudo listar', await listRes.text().catch(() => ''))
    return []
  }
  const existing = new Set(
    ((await listRes.json()) as { data?: { name: string }[] }).data?.map((t) => t.name) ?? []
  )
  const created: string[] = []
  for (const t of Object.values(TEMPLATES)) {
    if (existing.has(t.name)) continue
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: t.name,
        language: LANG,
        category: 'UTILITY',
        components: [
          { type: 'BODY', text: t.body, example: { body_text: [t.example] } },
          ...(t.buttons ? [{ type: 'BUTTONS', buttons: t.buttons }] : []),
        ],
      }),
    })
    if (res.ok) created.push(t.name)
    else console.error(`[wa-templates] no se pudo crear ${t.name}`, await res.text().catch(() => ''))
  }
  return created
}

export interface WaTemplateData {
  clientName: string | null
  orgName: string
  /** Fecha/hora ya formateada en la zona del negocio (recordatorios). */
  when?: string
  serviceNames?: string | null
  appointmentId: string
  manageToken?: string | null
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

  const name = param(d.clientName?.trim().split(/\s+/)[0], 'qué tal')
  const org = param(d.orgName, 'nuestro negocio')
  const body =
    key === 'reminder_24h' || key === 'reminder_2h'
      ? [name, org, param(d.when, 'la hora acordada'), param(d.serviceNames, 'tu cita')]
      : [name, org]

  const payload = (id: string, index: number) => ({
    type: 'button',
    sub_type: 'quick_reply',
    index: String(index),
    parameters: [{ type: 'payload', payload: id }],
  })
  const buttons =
    key === 'reminder_24h'
      ? [
          payload(`conf:${d.appointmentId}`, 0),
          {
            type: 'button',
            sub_type: 'url',
            index: '1',
            parameters: [{ type: 'text', text: d.manageToken ?? '' }],
          },
        ]
      : key === 'followup_csat'
        ? [5, 3, 1].map((score, i) => payload(`csat:${d.appointmentId}:${score}`, i))
        : []

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
        components: [{ type: 'body', parameters: body }, ...buttons],
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
    await ensureWaTemplates(channel.wabaId, channel.token).catch(() => [])
  }
  return null
}
