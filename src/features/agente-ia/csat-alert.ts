import { sendEmail } from '@/features/emails/mailer'
import { lowCsatEmail } from '@/features/emails/templates'
import type { CsatInfo } from './csat'
import { createServiceClient } from '@/lib/supabase/service'
import { brandForOrg, brandOrigin } from '@/features/marca/brand'

/**
 * Nota baja en la encuesta → correo inmediato al dueño.
 *
 * Al cliente se le contesta "le pasamos tu comentario al equipo". Hasta ahora
 * nadie se lo pasaba a nadie: la nota quedaba en la base y el dueño se
 * enteraba, con suerte, al abrir el panel. Nunca lanza: un fallo de correo no
 * debe impedir que el cliente reciba su respuesta.
 */
export async function alertLowCsat(score: number, info: CsatInfo | null): Promise<void> {
  if (score > 2 || !info?.contact_email) return
  try {
    const { data: conv } = info.conversation_id
      ? await createServiceClient().from('conversations').select('organization_id').eq('id', info.conversation_id).maybeSingle()
      : { data: null }
    const brand = await brandForOrg(conv?.organization_id ?? null)
    const site = brandOrigin(brand)
    const { subject, html } = lowCsatEmail({
      brand,
      orgName: info.org_name ?? 'tu negocio',
      clientName: info.client_name ?? null,
      conversationUrl: info.conversation_id
        ? `${site}/dashboard/conversaciones/${info.conversation_id}`
        : `${site}/dashboard/conversaciones`,
    })
    await sendEmail({ to: info.contact_email, subject, html, brand })
  } catch (err) {
    console.error('[csat] no se pudo avisar de la nota baja', err)
  }
}
