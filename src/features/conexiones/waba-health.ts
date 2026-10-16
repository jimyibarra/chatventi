import 'server-only'
import { managementTokens } from '@/features/agente-ia/wa-templates'
import { parseWabaHealth, type HealthResponse, type WabaHealth } from './meta-helpers'

export type { WabaHealth, PaymentStatus } from './meta-helpers'
export { wabaBillingUrl } from './meta-helpers'

const GRAPH = 'https://graph.facebook.com/v25.0'

/**
 * Estado de la cuenta de WhatsApp en Meta: si puede enviar y si su tarjeta
 * funciona. Usa el token del usuario del sistema de ChatVenti (la cuenta del
 * negocio está compartida con nuestra app al conectarla). Nunca lanza: si
 * Meta no responde en 4 s, el estado queda «unknown».
 */
export async function getWabaHealth(wabaId: string, systemUserToken?: string | null): Promise<WabaHealth> {
  for (const token of managementTokens(null, systemUserToken ?? undefined)) {
    try {
      const res = await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}?fields=health_status,owner_business_info{id}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) continue
      return parseWabaHealth((await res.json()) as HealthResponse)
    } catch {
      /* siguiente token o «unknown» */
    }
  }
  return parseWabaHealth(null)
}
