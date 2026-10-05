import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  WA_TEMPLATES,
  ensureWaTemplates,
  listWaTemplates,
  managementTokens,
  type EnsureResult,
  type WaTemplateKey,
} from '@/features/agente-ia/wa-templates'

// Estado de las plantillas de WhatsApp de cada negocio, leído EN VIVO de Meta
// (es quien las aprueba). Usa service_role porque necesita el token del canal,
// que nunca sale al navegador.

export type TemplateState = 'approved' | 'pending' | 'rejected' | 'paused' | 'missing'

export type ChannelTemplates = {
  channelId: string
  orgId: string
  orgName: string
  phone: string | null
  /** No se pudo consultar Meta (sin WABA, token vencido…). */
  error: string | null
  states: Record<WaTemplateKey, { state: TemplateState; reason: string | null }>
}

const STATE: Record<string, TemplateState> = {
  APPROVED: 'approved',
  PENDING: 'pending',
  IN_APPEAL: 'pending',
  REJECTED: 'rejected',
  PAUSED: 'paused',
  DISABLED: 'paused',
  LIMIT_EXCEEDED: 'paused',
}

// Motivos de rechazo de Meta, dichos para el dueño.
const REASON: Record<string, string> = {
  ABUSIVE_CONTENT: 'Meta lo consideró contenido no permitido',
  INVALID_FORMAT: 'Formato inválido (variables o botones)',
  PROMOTIONAL: 'Meta lo considera publicidad',
  TAG_CONTENT_MISMATCH: 'La categoría no corresponde al texto',
  INCORRECT_CATEGORY: 'La categoría no corresponde al texto',
  SCAM: 'Meta lo marcó como posible fraude',
}

type ChannelRow = {
  id: string
  organization_id: string
  waba_id: string | null
  display_name: string | null
  credentials: unknown
  organizations: { name: string } | null
}

async function readChannel(ch: ChannelRow): Promise<ChannelTemplates> {
  const token = (ch.credentials as { access_token?: string } | null)?.access_token
  const base = { channelId: ch.id, orgId: ch.organization_id, orgName: ch.organizations?.name ?? '—', phone: ch.display_name }
  const empty = Object.fromEntries(WA_TEMPLATES.map((t) => [t.key, { state: 'missing' as const, reason: null }]))
  if (!ch.waba_id) return { ...base, error: 'El canal no tiene cuenta de WhatsApp Business registrada.', states: empty as ChannelTemplates['states'] }
  const list = await listWaTemplates(ch.waba_id, managementTokens(token))
  if (!list.ok) return { ...base, error: list.error, states: empty as ChannelTemplates['states'] }
  const states = Object.fromEntries(
    WA_TEMPLATES.map((t) => {
      const meta = list.byName.get(t.name)
      if (!meta) return [t.key, { state: 'missing', reason: null }]
      const state = STATE[meta.status] ?? 'pending'
      const reason = state === 'rejected' ? (REASON[meta.reason ?? ''] ?? 'Meta no indicó el motivo') : null
      return [t.key, { state, reason }]
    }),
  ) as ChannelTemplates['states']
  return { ...base, error: null, states }
}

async function whatsappChannels(opts: { orgId?: string; channelId?: string }): Promise<ChannelRow[]> {
  let q = createServiceClient()
    .from('channels')
    .select('id, organization_id, waba_id, display_name, credentials, organizations(name)')
    .eq('type', 'whatsapp')
    .order('created_at')
  if (opts.orgId) q = q.eq('organization_id', opts.orgId)
  if (opts.channelId) q = q.eq('id', opts.channelId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ChannelRow[]
}

/** Estado de cada plantilla en cada WhatsApp conectado (o solo los de un negocio). */
export async function getTemplateBoard(opts: { orgId?: string } = {}): Promise<ChannelTemplates[]> {
  return Promise.all((await whatsappChannels(opts)).map(readChannel))
}

export type PublishSummary = { channels: number; created: number; failed: { orgName: string; template: string; error: string }[] }

/** Pide a Meta las plantillas que falten en los WhatsApp elegidos. */
export async function publishTemplates(opts: { orgId?: string; channelId?: string }): Promise<PublishSummary> {
  const rows = await whatsappChannels(opts)
  const out: PublishSummary = { channels: rows.length, created: 0, failed: [] }
  for (const ch of rows) {
    const orgName = ch.organizations?.name ?? '—'
    if (!ch.waba_id) {
      out.failed.push({ orgName, template: 'Todas', error: 'El canal no tiene cuenta de WhatsApp Business registrada.' })
      continue
    }
    const token = (ch.credentials as { access_token?: string } | null)?.access_token
    const res: EnsureResult = await ensureWaTemplates(ch.waba_id, managementTokens(token))
    out.created += res.created.length
    if (res.error) out.failed.push({ orgName, template: 'Todas', error: res.error })
    for (const f of res.failed) out.failed.push({ orgName, template: f.name, error: f.error })
  }
  return out
}
