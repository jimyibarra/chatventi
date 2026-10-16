import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getWabaHealth } from './waba-health'
import type { CanSend, PaymentStatus } from './meta-helpers'

// Estado de los canales de un negocio para la API de socios (GET
// /organizations/{id}): PASEN muestra el avance al dueño y su equipo ve quién
// se atoró. Solo estados y nombres visibles; nunca tokens ni ids de Meta.

type ChannelStatus = 'active' | 'pending' | 'disabled' | 'none'
export type Connections = {
  whatsapp: { status: ChannelStatus; number: string | null; mode: 'cloud_api' | 'coexistence' | null; canSend: CanSend | null; paymentMethod: PaymentStatus | null }
  messenger: { status: ChannelStatus; name: string | null }
  instagram: { status: ChannelStatus; name: string | null }
}

type Row = { type: string; status: string; display_name: string | null; waba_id: string | null; mode: string | null }
const RANK: Record<string, number> = { active: 3, pending: 2, disabled: 1 }
const asStatus = (s: string | undefined): ChannelStatus => (s === 'active' || s === 'pending' || s === 'disabled' ? s : 'none')

/** El mejor canal de cada tipo (activo antes que pendiente, pendiente antes que desactivado). */
function best(rows: Row[], type: string): Row | undefined {
  return rows.filter((r) => r.type === type).sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0))[0]
}

export async function channelConnections(service: SupabaseClient<Database>, orgId: string): Promise<Connections> {
  const { data } = await service
    .from('channels')
    .select('type, status, display_name, waba_id, mode:credentials->>mode')
    .eq('organization_id', orgId)
    .in('type', ['whatsapp', 'messenger', 'instagram'])
  const rows = (data ?? []) as unknown as Row[]
  const wa = best(rows, 'whatsapp')
  const health = wa?.waba_id && wa.status !== 'disabled' ? await getWabaHealth(wa.waba_id) : null
  const fb = best(rows, 'messenger')
  const ig = best(rows, 'instagram')
  return {
    whatsapp: {
      status: asStatus(wa?.status),
      number: wa?.display_name ?? null,
      mode: wa ? (wa.mode === 'coexistence' ? 'coexistence' : 'cloud_api') : null,
      canSend: health?.canSend ?? null,
      paymentMethod: health?.payment ?? null,
    },
    messenger: { status: asStatus(fb?.status), name: fb?.display_name ?? null },
    instagram: { status: asStatus(ig?.status), name: ig?.display_name ?? null },
  }
}
