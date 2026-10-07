import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CHATVENTI, brandOrigin as brandOriginOf, type Brand } from './brand-shared'

export type { Brand } from './brand-shared'
export { CHATVENTI, brandOrigin, brandStyle } from './brand-shared'

// Resolución de la marca (servidor):
//   · por HOST: una visita a agenda.pasen.mx ve ¡Pasen! aunque no haya sesión
//     (login, recuperar, ayuda, 404);
//   · por ORGANIZACIÓN: un negocio de socio ve ¡Pasen! en su panel, sus correos
//     y sus páginas públicas, entre desde donde entre.

type PartnerRow = {
  id: string
  name: string
  kind: string
  display_name: string | null
  logo_url: string | null
  logo_white_url: string | null
  icon_url: string | null
  primary_color: string | null
  accent_color: string | null
  support_email: string | null
  panel_url: string | null
  app_domain: string | null
  email_from: string | null
}

const PARTNER_COLS = 'id, name, kind, display_name, logo_url, logo_white_url, icon_url, primary_color, accent_color, support_email, panel_url, app_domain, email_from'

/** Un socio solo trae marca propia si es interno y tiene nombre visible; si no, se muestra ChatVenti. */
function fromPartner(p: PartnerRow | null): Brand {
  if (!p || p.kind !== 'internal' || !p.display_name) return CHATVENTI
  return {
    partnerId: p.id,
    name: p.display_name,
    logoUrl: p.logo_url ?? CHATVENTI.logoUrl,
    logoWhiteUrl: p.logo_white_url ?? p.logo_url ?? CHATVENTI.logoUrl,
    iconUrl: p.icon_url ?? CHATVENTI.iconUrl,
    primaryColor: p.primary_color ?? CHATVENTI.primaryColor,
    accentColor: p.accent_color ?? CHATVENTI.accentColor,
    supportEmail: p.support_email ?? CHATVENTI.supportEmail,
    panelUrl: p.panel_url,
    appDomain: p.app_domain,
    emailFrom: p.email_from ?? `${p.display_name} <${p.support_email ?? CHATVENTI.supportEmail}>`,
    tagline: 'Tu agenda y tu recepcionista, en un solo lugar',
  }
}

export const brandForHost = cache(async (host: string | null): Promise<Brand> => {
  const h = (host ?? '').split(':')[0].toLowerCase()
  if (!h || h === 'www.chatventi.com' || h === 'chatventi.com' || h === 'localhost') return CHATVENTI
  const { data } = await createServiceClient().from('partners').select(PARTNER_COLS).eq('app_domain', h).maybeSingle()
  return fromPartner(data as PartnerRow | null)
})

export const brandForPartner = cache(async (partnerId: string | null): Promise<Brand> => {
  if (!partnerId) return CHATVENTI
  const { data } = await createServiceClient().from('partners').select(PARTNER_COLS).eq('id', partnerId).maybeSingle()
  return fromPartner(data as PartnerRow | null)
})

export const brandForOrg = cache(async (orgId: string | null): Promise<Brand> => {
  if (!orgId) return CHATVENTI
  const { data } = await createServiceClient().from('organizations').select('partner_id').eq('id', orgId).maybeSingle()
  return brandForPartner(data?.partner_id ?? null)
})

/** Marca de la visita actual: el host manda; si no, la organización del usuario con sesión. */
export const currentBrand = cache(async (): Promise<Brand> => {
  const byHost = await brandForHost((await headers()).get('host'))
  if (byHost.partnerId) return byHost
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return CHATVENTI
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  return brandForOrg(profile?.organization_id ?? null)
})

/** Base del enlace «Cambiar o cancelar» de las plantillas de WhatsApp de un negocio. */
export async function manageBaseForOrg(orgId: string | null): Promise<string> {
  return `${brandOriginOf(await brandForOrg(orgId))}/c/`
}
