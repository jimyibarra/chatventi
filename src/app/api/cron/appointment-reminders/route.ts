import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sendToCustomerByChannel,
  sendButtonsToCustomerByChannel,
} from '@/features/agente-ia/senders'
import { sendEmail, emailsEnabled } from '@/features/emails/mailer'
import { trialEndingEmail } from '@/features/emails/templates'

export const runtime = 'nodejs'

type DueItem = {
  appointment_id: string
  manage_token: string | null
  // Nulos cuando el cliente nunca ha chateado (cita creada por staff o web):
  // no hay canal por dónde enviar; se reporta como no_channel, no se omite.
  conversation_id: string | null
  channel_type: string | null
  channel_external_id: string | null
  send_to: string | null
  starts_at: string
  tz: string
  org_name: string
  client_name: string | null
  service_names: string | null
}

function manageUrl(token: string | null): string | null {
  if (!token) return null
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com'
  return `${base.replace(/\/$/, '')}/c/${token}`
}

type Kind = '24h' | '2h' | 'followup'

function firstName(name: string | null): string {
  return name ? ` ${name.trim().split(/\s+/)[0]}` : ''
}

function whenLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

function timeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

function buildMessage(kind: Kind, item: DueItem): string {
  const name = firstName(item.client_name)
  const svc = item.service_names ? ` de ${item.service_names}` : ''
  if (kind === '24h') {
    const url = manageUrl(item.manage_token)
    const manage = url
      ? `\nSi necesitas cambiar la fecha o cancelar: ${url}`
      : ' Si necesitas reagendar o cancelar, respóndenos por aquí.'
    return `Hola${name}, te recordamos tu cita${svc} en ${item.org_name} el ${whenLabel(
      item.starts_at,
      item.tz
    )}. ¡Te esperamos!${manage}`
  }
  if (kind === '2h') {
    return `Hola${name}, tu cita${svc} en ${item.org_name} es hoy a las ${timeLabel(
      item.starts_at,
      item.tz
    )}. ¡Te esperamos! 🙌`
  }
  // followup
  return `Hola${name}, gracias por tu visita a ${item.org_name}. ¿Cómo estuvo tu experiencia${svc}? Nos encantaría atenderte de nuevo. 😊`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const kinds: Kind[] = ['24h', '2h', 'followup']
  const summary: Record<Kind, { sent: number; skipped: number; no_channel: number }> = {
    '24h': { sent: 0, skipped: 0, no_channel: 0 },
    '2h': { sent: 0, skipped: 0, no_channel: 0 },
    followup: { sent: 0, skipped: 0, no_channel: 0 },
  }

  for (const kind of kinds) {
    const { data, error } = await service.rpc('get_due_reminders', { p_kind: kind })
    if (error) {
      console.error(`[cron-reminders] get_due_reminders(${kind}) error`, error.message)
      continue
    }
    const items = (data as unknown as DueItem[]) ?? []

    for (const item of items) {
      // Cliente sin conversación (cita de staff/web): no hay canal por dónde
      // enviar. NO se reclama (si el cliente escribe dentro de la ventana, el
      // siguiente cron sí lo alcanza) y queda visible en el summary/logs.
      if (!item.conversation_id || !item.channel_type || !item.channel_external_id || !item.send_to) {
        summary[kind].no_channel++
        console.warn(
          `[cron-reminders] cita ${item.appointment_id} sin canal de contacto (${kind})`
        )
        continue
      }

      // Reclamo atómico: solo un envío por ventana (idempotente).
      const { data: claimed } = await service.rpc('claim_reminder', {
        p_appointment_id: item.appointment_id,
        p_kind: kind,
      })
      if (!claimed) {
        summary[kind].skipped++
        continue
      }

      const text = buildMessage(kind, item)
      let extId: string | null = null
      try {
        // Recordatorio 24h: botón "Confirmar asistencia" (WA reply button /
        // TG inline). Si el envío con botones falla, cae a texto plano.
        if (kind === '24h') {
          extId = await sendButtonsToCustomerByChannel(
            service,
            item.channel_type,
            item.channel_external_id,
            item.send_to,
            text,
            [{ id: `conf:${item.appointment_id}`, title: 'Confirmar asistencia' }]
          )
        }
        if (!extId) {
          extId = await sendToCustomerByChannel(
            service,
            item.channel_type,
            item.channel_external_id,
            item.send_to,
            text
          )
        }
      } catch (err) {
        console.error('[cron-reminders] error enviando', err)
      }

      // Registra el mensaje saliente (sender 'system'). service_role bypassa RLS.
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

      summary[kind].sent++
    }
  }

  // Recordatorio de fin de prueba (~48h antes), por correo. Idempotente.
  const trialSummary = await sendTrialEndingEmails(service)

  // Limpieza de la demo de la landing: las conversaciones/citas de la org
  // demo son efímeras; se borran las de más de 24h en cada corrida.
  await cleanupDemoOrg(service)

  return NextResponse.json({ ok: true, summary, trial: trialSummary })
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

// Suscripciones en prueba cuyo trial_end cae dentro de las próximas 48h y a las
// que aún no se les avisó. Marca `trial_ending_email_sent_at` para no repetir.
async function sendTrialEndingEmails(
  service: ReturnType<typeof createServiceClient>
): Promise<{ sent: number; skipped: number }> {
  const result = { sent: 0, skipped: 0 }
  // Si el SMTP aún no está configurado, NO tocamos nada: así no "quemamos" el
  // aviso de fin de prueba antes de que el correo esté activo.
  if (!emailsEnabled()) return result
  try {
    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

    const { data: subs, error } = await service
      .from('subscriptions')
      .select('organization_id, trial_end')
      .eq('status', 'trialing')
      .is('trial_ending_email_sent_at', null)
      .not('trial_end', 'is', null)
      .lte('trial_end', in48h)
      .gt('trial_end', now.toISOString())
    if (error) {
      console.error('[cron-trial] query error', error.message)
      return result
    }

    for (const sub of subs ?? []) {
      const { data: org } = await service
        .from('organizations')
        .select('name, contact_email')
        .eq('id', sub.organization_id)
        .maybeSingle()
      if (!org?.contact_email) {
        result.skipped++
        continue
      }
      const trialEndLabel = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(sub.trial_end as string))

      const { subject, html } = trialEndingEmail({ orgName: org.name, trialEndLabel, siteUrl: SITE })
      const ok = await sendEmail({ to: org.contact_email, subject, html })
      // Marca aunque falle el envío para no reintentar en bucle cada día; si el
      // SMTP aún no está configurado, simplemente no se enviará (log en mailer).
      await service
        .from('subscriptions')
        .update({ trial_ending_email_sent_at: new Date().toISOString() })
        .eq('organization_id', sub.organization_id)
      if (ok) result.sent++
      else result.skipped++
    }
  } catch (e) {
    console.error('[cron-trial] error', e)
  }
  return result
}

const DEMO_ORG_ID = '12974a7a-fb18-4713-9d2c-28c251b09312'

async function cleanupDemoOrg(service: ReturnType<typeof createServiceClient>): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: oldConvs } = await service
      .from('conversations')
      .select('id, client_id')
      .eq('organization_id', DEMO_ORG_ID)
      .lt('created_at', cutoff)

    if (!oldConvs?.length) return

    const convIds = oldConvs.map((c) => c.id)
    const clientIds = [...new Set(oldConvs.map((c) => c.client_id).filter(Boolean))] as string[]

    await service.from('messages').delete().in('conversation_id', convIds)
    await service.from('ai_approvals').delete().in('conversation_id', convIds)
    await service.from('conversations').delete().in('id', convIds)

    if (clientIds.length) {
      const { data: appts } = await service
        .from('appointments')
        .select('id')
        .eq('organization_id', DEMO_ORG_ID)
        .in('client_id', clientIds)
      const apptIds = (appts ?? []).map((a) => a.id)
      if (apptIds.length) {
        await service.from('appointment_services').delete().in('appointment_id', apptIds)
        await service.from('appointments').delete().in('id', apptIds)
      }
      await service.from('clients').delete().in('id', clientIds)
    }
  } catch (err) {
    console.error('[cron-reminders] limpieza demo error', err)
  }
}
