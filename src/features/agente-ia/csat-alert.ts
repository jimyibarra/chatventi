import { sendEmail } from '@/features/emails/mailer'
import { lowCsatEmail } from '@/features/emails/templates'
import type { CsatInfo } from './csat'

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
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')
    const { subject, html } = lowCsatEmail({
      orgName: info.org_name ?? 'tu negocio',
      clientName: info.client_name ?? null,
      conversationUrl: info.conversation_id
        ? `${site}/dashboard/conversaciones/${info.conversation_id}`
        : `${site}/dashboard/conversaciones`,
    })
    await sendEmail({ to: info.contact_email, subject, html })
  } catch (err) {
    console.error('[csat] no se pudo avisar de la nota baja', err)
  }
}
