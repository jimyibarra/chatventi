import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { sendToCustomerByChannel } from './senders'
import { sendEmail } from '@/features/emails/mailer'
import { dailyReportEmail } from '@/features/emails/templates'

type ServiceClient = SupabaseClient<Database>

// Días de silencio antes de dar por frío a un interesado. 4: lo bastante
// para no interrumpir a quien todavía se lo está pensando, y lo bastante
// pronto para que aún se acuerde de nosotros.
export const COLD_DAYS = 4

export type ColdSummary = { sent: number; skipped: number; failed: number }
export type ReportSummary = { sent: number; skipped: number; failed: number }

function firstName(name: string | null): string {
  return name ? ` ${name.trim().split(/\s+/)[0]}` : ''
}

/**
 * Un ÚNICO mensaje de reactivación a quien preguntó y nunca agendó. Hoy esos
 * leads se pierden en silencio: todo el sistema de recordatorios cuelga de
 * `appointments`, así que sin cita no existen.
 *
 * 🔴 El reclamo va ANTES del envío, así que un envío fallido NO se reintenta.
 * Es deliberado: en WhatsApp, fuera de la ventana de 24 h un mensaje
 * free-form puede fallar en silencio (este proyecto aún no tiene plantillas
 * HSM aprobadas), y reintentar cada día acabaría acosando al cliente en
 * cuanto la ventana se reabriera. Un intento por conversación y punto.
 */
export async function runColdFollowups(service: ServiceClient): Promise<ColdSummary> {
  const out: ColdSummary = { sent: 0, skipped: 0, failed: 0 }

  const { data, error } = await service.rpc('get_cold_conversations', { p_days: COLD_DAYS })
  if (error) {
    console.error('[cron-cold] get_cold_conversations error', error.message)
    return out
  }
  const items =
    (data as {
      conversation_id: string
      organization_id: string
      org_name: string
      client_name: string | null
      channel_type: string
      channel_external_id: string
      send_to: string
    }[]) ?? []

  for (const item of items) {
    const { data: claimed } = await service.rpc('claim_cold_followup', {
      p_conversation_id: item.conversation_id,
    })
    if (!claimed) {
      out.skipped++
      continue
    }

    const text = `Hola${firstName(
      item.client_name
    )}, te escribimos de ${item.org_name} 👋 Vimos que quedó tu consulta en el aire. Si quieres, te apartamos un lugar: dime qué día te viene bien y lo agendamos.`

    let extId: string | null = null
    try {
      extId = await sendToCustomerByChannel(
        service,
        item.channel_type,
        item.channel_external_id,
        item.send_to,
        text
      )
    } catch (err) {
      console.error('[cron-cold] error enviando', err)
    }
    if (!extId) {
      out.failed++
      continue
    }

    await service.from('messages').insert({
      conversation_id: item.conversation_id,
      direction: 'outbound',
      sender: 'system',
      body: text,
      external_id: extId,
    })
    await service
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', item.conversation_id)
    out.sent++
  }

  return out
}

/**
 * Resumen del día anterior al correo del dueño. Hoy no recibe ni un solo
 * correo sobre su negocio: abre el panel cuando se acuerda.
 *
 * Idempotencia: `claim_daily_report` inserta (org, día) con clave primaria
 * compuesta — el insert ES el candado. Un reintento de Vercel no manda dos
 * veces el mismo resumen.
 *
 * Ojo: `emailsEnabled()` omite el envío EN SILENCIO si faltan credenciales
 * SMTP, así que un resumen que "no llega" puede ser eso y no un fallo de las
 * cifras. Por eso se cuenta como `failed` cuando sendEmail no confirma.
 */
export async function runDailyReports(service: ServiceClient): Promise<ReportSummary> {
  const out: ReportSummary = { sent: 0, skipped: 0, failed: 0 }

  const { data, error } = await service.rpc('get_daily_report_orgs')
  if (error) {
    console.error('[cron-report] get_daily_report_orgs error', error.message)
    return out
  }
  const orgs =
    (data as { organization_id: string; org_name: string; contact_email: string }[]) ?? []
  if (orgs.length === 0) return out

  // El día que se resume: ayer.
  const yesterday = new Date(Date.now() - 86400000)
  const day = yesterday.toISOString().slice(0, 10)
  const dayLabel = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(yesterday)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(
    /\/$/,
    ''
  )

  for (const org of orgs) {
    const { data: claimed } = await service.rpc('claim_daily_report', {
      p_org: org.organization_id,
      p_date: day,
    })
    if (!claimed) {
      out.skipped++
      continue
    }

    try {
      const { data: raw } = await service.rpc('get_daily_report_data', {
        p_org: org.organization_id,
        p_day: day,
      })
      const d = (raw ?? {}) as {
        conversaciones?: number
        mensajes_recibidos?: number
        citas_creadas?: number
        escalamientos?: number
        calificacion_media?: number | null
        conversaciones_malas?: number
        citas_de_hoy?: number
      }

      const { subject, html } = dailyReportEmail({
        orgName: org.org_name,
        dayLabel,
        siteUrl,
        data: {
          conversaciones: d.conversaciones ?? 0,
          mensajes_recibidos: d.mensajes_recibidos ?? 0,
          citas_creadas: d.citas_creadas ?? 0,
          escalamientos: d.escalamientos ?? 0,
          calificacion_media: d.calificacion_media ?? null,
          conversaciones_malas: d.conversaciones_malas ?? 0,
          citas_de_hoy: d.citas_de_hoy ?? 0,
        },
      })
      const ok = await sendEmail({ to: org.contact_email, subject, html })
      if (ok) out.sent++
      else out.failed++
    } catch (err) {
      console.error('[cron-report] error', err)
      out.failed++
    }
  }

  return out
}
