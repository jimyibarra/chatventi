import { tool } from 'ai'
import { z } from 'zod'
import { consumeRateLimit } from '@/shared/security/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'

// Herramientas del asistente de ventas de ¡Pasen! (socio interno): crear la
// página de muestra del prospecto en PASEN y mandarle el acceso a su panel.
//
// Existen SOLO para la organización PASEN_SALES_ORG_ID y solo si las cuatro
// variables están puestas; sin ellas el asistente sigue como hoy. El teléfono
// nunca lo decide el modelo: se usa el de la conversación (wa_id), que
// WhatsApp ya comprobó. La clave vive en el servidor y no se registra nunca.

export const SANDBOX_PHONE = '5215500000000'
export const PASEN_TIMEOUT_MS = 20_000
export const ORG_HOURLY_LIMIT = 20
export const MAX_PAGES_PER_CONVERSATION = 1
export const MAX_ACCESS_PER_CONVERSATION = 2
export const NOTE_PAGE = '📄 Página de muestra de ¡Pasen!'
export const NOTE_ACCESS = '✉️ Acceso al panel de ¡Pasen!'

// Borradores que van a aprobación humana cuando PASEN no responde: el código
// escala solo; no se deja al modelo la decisión de inventar un enlace.
export const DRAFT_PAGE_UNAVAILABLE =
  'Gracias 🙏 En este momento no pude generar tu página de muestra, pero ya le avisé a una persona del equipo de ¡Pasen! para que te la mande hoy mismo por aquí.'
export const DRAFT_ACCESS_UNAVAILABLE =
  'Gracias 🙏 No pude mandarte el acceso en este momento; una persona del equipo de ¡Pasen! te lo confirma hoy mismo.'

export type PasenEnv = { orgId: string; pageUrl: string; accessUrl: string; secret: string }

/** Las cuatro variables, o null: sin alguna, las herramientas no existen. */
export type EnvLike = Record<string, string | undefined>

export function pasenEnv(env: EnvLike = process.env): PasenEnv | null {
  const orgId = env.PASEN_SALES_ORG_ID?.trim()
  const pageUrl = env.PASEN_SAMPLE_PAGE_URL?.trim()
  const accessUrl = env.PASEN_PANEL_ACCESS_URL?.trim()
  const secret = env.PASEN_SAMPLE_PAGE_SECRET?.trim()
  if (!orgId || !pageUrl || !accessUrl || !secret) return null
  return { orgId, pageUrl, accessUrl, secret }
}

// Sin teléfono a propósito: zod descarta cualquier llave extra que mande el modelo.
export const samplePageInput = z.object({
  businessName: z.string().trim().min(2).max(160).describe('Nombre del negocio tal como lo dijo el cliente'),
  businessType: z.string().trim().min(1).max(60).describe('Giro como lo dijo el cliente: «barbería», «consultorio dental»…'),
  city: z.string().trim().max(120).optional().describe('Ciudad, si la dijo'),
  contactName: z.string().trim().max(120).optional().describe('Nombre del cliente, si lo dijo'),
  summary: z
    .string()
    .trim()
    .max(600)
    .optional()
    .describe('En una o dos frases: qué quiere lograr el cliente y qué tiene hoy'),
})
export const panelAccessInput = z.object({
  email: z.string().trim().email().max(254).describe('Correo del cliente'),
})

export type PasenCall = { status: number; json: unknown }
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

/** POST a PASEN con la clave; 20 s de tope y sin reintentos. status 0 = red o tiempo agotado. */
export async function callPasen(url: string, secret: string, body: Record<string, unknown>, fetcher: Fetcher = fetch): Promise<PasenCall> {
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PASEN_TIMEOUT_MS),
    })
    const json: unknown = await res.json().catch(() => null)
    return { status: res.status, json }
  } catch (e) {
    // Solo el tipo de fallo: nunca el cuerpo ni los encabezados.
    console.error('[pasen-tools] sin respuesta de PASEN:', e instanceof Error ? e.name : 'error')
    return { status: 0, json: null }
  }
}

type SampleOk = { url: string; trialUntilText: string; created?: boolean; test?: boolean }
type SampleResult = { url: string; trialUntilText: string } | { error: 'unknown_business_type'; options: string[] } | { error: 'no_disponible' }

/** Lo que ve el modelo tras crear la página. */
export function mapSampleResponse(r: PasenCall): SampleResult {
  const j = (r.json ?? {}) as Partial<SampleOk> & { error?: string; options?: unknown }
  if (r.status === 200 && typeof j.url === 'string') return { url: j.url, trialUntilText: String(j.trialUntilText ?? '') }
  if (r.status === 422 && j.error === 'unknown_business_type' && Array.isArray(j.options)) {
    return { error: 'unknown_business_type', options: j.options.filter((o): o is string => typeof o === 'string') }
  }
  return { error: 'no_disponible' }
}

type AccessResult = { resultado: 'enviado' | 'lo_revisa_el_equipo' } | { error: 'sin_pagina' | 'no_disponible' }

/** Lo que ve el modelo tras pedir el acceso. */
export function mapAccessResponse(r: PasenCall): AccessResult {
  const j = (r.json ?? {}) as { sent?: boolean; reason?: string; error?: string }
  if (r.status === 200 && j.sent === true) return { resultado: 'enviado' }
  if (r.status === 200 && j.sent === false && j.reason === 'team_review') return { resultado: 'lo_revisa_el_equipo' }
  if (r.status === 404 && j.error === 'not_found') return { error: 'sin_pagina' }
  return { error: 'no_disponible' }
}

/** ¿El cliente escribió ese correo (sin importar mayúsculas) en algún mensaje? */
export function clientWrote(inboundTexts: string[], email: string): boolean {
  const needle = email.trim().toLowerCase()
  return inboundTexts.some((t) => t.toLowerCase().includes(needle))
}

export type PasenDeps = {
  fetcher?: Fetcher
  /** Tope por organización y hora. true = puede seguir. */
  orgLimit?: (orgId: string) => Promise<boolean>
  /** Cuántas constancias con ese prefijo lleva la conversación. */
  countNotes?: (conversationId: string, prefix: string) => Promise<number>
  /** Deja la constancia visible en Chats. */
  note?: (conversationId: string, body: string) => Promise<void>
}

const realDeps: Required<PasenDeps> = {
  fetcher: (url, init) => fetch(url, init),
  orgLimit: (orgId) => consumeRateLimit({ bucket: 'pasen_tools', key: orgId, limit: ORG_HOURLY_LIMIT, windowSeconds: 3600 }),
  countNotes: async (conversationId, prefix) => {
    const { count } = await createServiceClient()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender', 'system')
      .like('body', `${prefix}%`)
    return count ?? 0
  },
  note: async (conversationId, body) => {
    await createServiceClient().rpc('log_outbound_message', { p_conversation_id: conversationId, p_body: body, p_sender: 'system' })
  },
}

export function buildPasenTools(p: {
  orgId: string
  conversationId: string
  /** Identificador del cliente en el canal (wa_id en WhatsApp). */
  clientHandle: string
  /** Lo que ESCRIBIÓ el cliente en la conversación: el correo tiene que venir de ahí. */
  inboundTexts: string[]
  sandbox: boolean
  /** El código escala a humano con este borrador cuando PASEN no responde. */
  onUnavailable: (draft: string) => void
  env?: EnvLike
  deps?: PasenDeps
}) {
  const env = pasenEnv(p.env)
  if (!env || env.orgId !== p.orgId) return null
  const d = { ...realDeps, ...p.deps }
  const phone = p.sandbox ? SANDBOX_PHONE : p.clientHandle
  const common = { phone, conversationId: p.conversationId, test: p.sandbox }

  /** Topes: en el chat de prueba no se cuentan (no se crea nada). */
  async function withinLimits(prefix: string, max: number): Promise<boolean> {
    if (p.sandbox) return true
    if ((await d.countNotes(p.conversationId, prefix)) >= max) return false
    return d.orgLimit(p.orgId)
  }

  return {
    create_sample_page: tool({
      description:
        'Crea la página de muestra de ¡Pasen! del negocio del cliente y devuelve su enlace. Úsala solo cuando el cliente ya confirmó el nombre de su negocio y su giro; la ciudad y su nombre son opcionales. Una sola vez por conversación.',
      inputSchema: samplePageInput,
      execute: async (input) => {
        if (!(await withinLimits(NOTE_PAGE, MAX_PAGES_PER_CONVERSATION))) {
          p.onUnavailable(DRAFT_PAGE_UNAVAILABLE)
          return { error: 'limite' as const }
        }
        const r = await callPasen(
          env.pageUrl,
          env.secret,
          {
            businessName: input.businessName,
            businessType: input.businessType,
            city: input.city ?? null,
            contactName: input.contactName ?? null,
            summary: input.summary ?? null,
            ...common,
          },
          d.fetcher,
        )
        const out = mapSampleResponse(r)
        if ('error' in out && out.error === 'no_disponible') {
          console.error('[pasen-tools] create_sample_page', r.status || 'timeout')
          p.onUnavailable(DRAFT_PAGE_UNAVAILABLE)
        } else if ('url' in out && !p.sandbox) {
          const created = (r.json as SampleOk).created !== false
          await d.note(p.conversationId, `${NOTE_PAGE} ${created ? 'creada' : 'ya existía'}: ${out.url} · prueba hasta ${out.trialUntilText}`)
        }
        return out
      },
    }),
    send_panel_access: tool({
      description:
        'Manda al correo del cliente su acceso para editar la página que se creó en esta conversación. Úsala cuando el cliente te dé su correo, solo después de create_sample_page.',
      inputSchema: panelAccessInput,
      execute: async (input) => {
        // Probado en vivo: el modelo se inventó «luis@example.com» a partir del
        // nombre del cliente. Si el correo no lo escribió el cliente, no se manda.
        if (!clientWrote(p.inboundTexts, input.email)) return { error: 'correo_no_confirmado' as const }
        if (!(await withinLimits(NOTE_ACCESS, MAX_ACCESS_PER_CONVERSATION))) {
          p.onUnavailable(DRAFT_ACCESS_UNAVAILABLE)
          return { error: 'limite' as const }
        }
        const r = await callPasen(env.accessUrl, env.secret, { email: input.email, ...common }, d.fetcher)
        const out = mapAccessResponse(r)
        if ('error' in out && out.error === 'no_disponible') {
          console.error('[pasen-tools] send_panel_access', r.status || 'timeout')
          p.onUnavailable(DRAFT_ACCESS_UNAVAILABLE)
        } else if ('resultado' in out && !p.sandbox) {
          await d.note(
            p.conversationId,
            out.resultado === 'enviado' ? `${NOTE_ACCESS} enviado a ${input.email}` : `${NOTE_ACCESS} pendiente: el equipo de ¡Pasen! revisa ${input.email}`,
          )
        }
        return out
      },
    }),
  }
}

/** Reglas del prompt cuando las herramientas de ¡Pasen! están activas. */
export const PASEN_PROMPT_RULES = [
  'HERRAMIENTAS DE ¡PASEN! (página de muestra del prospecto):',
  '- create_sample_page: úsala UNA sola vez, solo cuando el cliente ya confirmó el nombre de su negocio y su giro (ciudad y su nombre son opcionales). Manda el enlace EXACTO que devuelve (url), escrito solo y en texto plano (sin corchetes ni paréntesis), y dile hasta qué fecha dura su prueba gratis (trialUntilText). NUNCA inventes ni modifiques un enlace.',
  '- Si devuelve error unknown_business_type con options, ofrece esas opciones tal cual y vuelve a intentar UNA sola vez con la que elija.',
  '- Si devuelve error no_disponible, limite o sin_pagina, NO inventes nada: usa request_human_approval con un borrador amable que diga que una persona del equipo de ¡Pasen! le escribe hoy mismo.',
  '- Después de crear la página, pide su correo y usa send_panel_access SOLO con el correo que el cliente escribió, tal cual. NUNCA inventes ni deduzcas un correo; si devuelve correo_no_confirmado, pídele al cliente que te lo escriba. Si devuelve resultado "enviado", dile que le llegó un correo de ¡Pasen! con el botón para entrar (sirve una vez y vence en 1 hora). Si devuelve "lo_revisa_el_equipo", dile que una persona del equipo le confirma su acceso hoy mismo.',
]
