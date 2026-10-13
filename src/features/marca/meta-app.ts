import 'server-only'
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

// =====================================================================
// Qué app de Meta usa cada negocio (nivel 3 de marca).
//
//   Por defecto, la de ChatVenti (variables de entorno). Un socio interno
//   puede traer la suya: entonces la ventana de Meta que ve el dueño al
//   conectar WhatsApp o Facebook/Instagram muestra el nombre y el logo del
//   socio. La app del socio tiene que estar COMPLETA (id, secreto y la
//   configuración del Embedded Signup); si falta algo, se usa la de ChatVenti
//   para no dejar al negocio sin poder conectar.
//
//   Los webhooks de Meta son los mismos endpoints para todas las apps: la
//   firma se comprueba contra el secreto de cada app conocida.
// =====================================================================

export type MetaApp = {
  appId: string
  appSecret: string
  /** Configuración del Embedded Signup de WhatsApp. */
  configId: string
  /** Configuración del inicio de sesión para empresas (páginas/Instagram). */
  pagesConfigId: string
  /** Token del System User para administrar WABAs y plantillas; si no hay, se usa el del negocio. */
  systemUserToken: string | null
  /** null = app de ChatVenti. */
  partnerId: string | null
}

const DEFAULT_PAGES_CONFIG_ID = '904116956101183'

export function chatventiMetaApp(): MetaApp | null {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) return null
  return {
    appId,
    appSecret,
    configId: process.env.NEXT_PUBLIC_META_CONFIG_ID?.trim() ?? '',
    pagesConfigId: process.env.NEXT_PUBLIC_META_PAGES_CONFIG_ID?.trim() || DEFAULT_PAGES_CONFIG_ID,
    systemUserToken: process.env.META_SYSTEM_USER_TOKEN?.trim() || null,
    partnerId: null,
  }
}

type PartnerMetaRow = {
  id: string
  kind: string
  status: string
  meta_app_id: string | null
  meta_app_secret: string | null
  meta_config_id: string | null
  meta_pages_config_id: string | null
  meta_system_user_token: string | null
}
const COLS = 'id, kind, status, meta_app_id, meta_app_secret, meta_config_id, meta_pages_config_id, meta_system_user_token'

function fromPartner(p: PartnerMetaRow | null): MetaApp | null {
  if (!p || p.kind !== 'internal' || p.status !== 'active') return null
  if (!p.meta_app_id || !p.meta_app_secret || !p.meta_config_id) return null
  const fallback = chatventiMetaApp()
  return {
    appId: p.meta_app_id,
    appSecret: p.meta_app_secret,
    configId: p.meta_config_id,
    pagesConfigId: p.meta_pages_config_id ?? fallback?.pagesConfigId ?? DEFAULT_PAGES_CONFIG_ID,
    systemUserToken: p.meta_system_user_token,
    partnerId: p.id,
  }
}

export const metaAppForPartner = cache(async (partnerId: string | null): Promise<MetaApp | null> => {
  if (!partnerId) return chatventiMetaApp()
  const { data } = await createServiceClient().from('partners').select(COLS).eq('id', partnerId).maybeSingle()
  return fromPartner(data as PartnerMetaRow | null) ?? chatventiMetaApp()
})

/** La app con la que un negocio conecta sus canales: la de su socio si la tiene completa; si no, la de ChatVenti. */
export const metaAppForOrg = cache(async (orgId: string | null): Promise<MetaApp | null> => {
  if (!orgId) return chatventiMetaApp()
  const { data } = await createServiceClient().from('organizations').select('partner_id').eq('id', orgId).maybeSingle()
  return metaAppForPartner(data?.partner_id ?? null)
})

/** Secretos de TODAS las apps que pueden firmarnos un webhook: la de ChatVenti y las de los socios. */
export async function metaAppSecrets(): Promise<string[]> {
  const out = new Set<string>()
  const own = process.env.META_APP_SECRET?.trim()
  if (own) out.add(own)
  const { data } = await createServiceClient().from('partners').select('meta_app_secret').not('meta_app_secret', 'is', null)
  for (const row of data ?? []) if (row.meta_app_secret) out.add(row.meta_app_secret)
  return [...out]
}
