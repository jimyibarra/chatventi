import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sendToCustomerByChannel,
  sendButtonsToCustomerByChannel,
} from '@/features/agente-ia/senders'
import { sendEmail, emailsEnabled, verifyTransport } from '@/features/emails/mailer'
import {
  trialEndingEmail,
  trialEndedEmail,
  deletionWarningEmail,
  dataDeletedEmail,
} from '@/features/emails/templates'
import { DATA_RETENTION_DAYS } from '@/features/billing/plans'

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

  // Recordatorios recurrentes del expediente ("vuelve a cortarte", "limpieza
  // dental cada 6 meses"). Independientes de las citas.
  const recurring = await runClientReminders(service)

  // Funnel de la prueba gratis: recordatorio → bloqueo → aviso → borrado.
  const trialSummary = await runTrialFunnel(service)

  // Limpieza de la demo de la landing: las conversaciones/citas de la org
  // demo son efímeras; se borran las de más de 24h en cada corrida.
  await cleanupDemoOrg(service)

  // Diagnóstico del SMTP (handshake real, sin enviar): confirma que las
  // credenciales de correo en producción son correctas.
  const emailsStatus = await verifyTransport()

  return NextResponse.json({
    ok: true,
    summary,
    recurring,
    trial: trialSummary,
    emails: emailsStatus,
  })
}

type DueClientReminder = {
  reminder_id: string
  message: string
  conversation_id: string | null
  channel_type: string | null
  channel_external_id: string | null
  send_to: string | null
  client_name: string | null
  org_name: string
}

/**
 * Recordatorios recurrentes del expediente del cliente.
 *
 * Idempotencia: `claim_client_reminder` adelanta `next_due_at` al futuro dentro
 * de la misma transacción, así que una segunda corrida ya no lo ve vencido. No
 * hace falta una columna de "ya enviado".
 *
 * Igual que los recordatorios de cita, solo alcanza a clientes CON conversación:
 * sin canal no hay por dónde escribir. Esos se reportan como `no_channel` y NO
 * se reclaman, para que salgan en cuanto el cliente escriba por primera vez.
 */
async function runClientReminders(
  service: ReturnType<typeof createServiceClient>
): Promise<{ sent: number; skipped: number; no_channel: number }> {
  const out = { sent: 0, skipped: 0, no_channel: 0 }
  const { data, error } = await service.rpc('get_due_client_reminders')
  if (error) {
    console.error('[cron-recurring] get_due_client_reminders error', error.message)
    return out
  }
  const items = (data as unknown as DueClientReminder[]) ?? []

  for (const item of items) {
    if (!item.conversation_id || !item.channel_type || !item.channel_external_id || !item.send_to) {
      out.no_channel++
      continue
    }

    const { data: claimed } = await service.rpc('claim_client_reminder', {
      p_id: item.reminder_id,
    })
    if (!claimed) {
      out.skipped++
      continue
    }

    let extId: string | null = null
    try {
      extId = await sendToCustomerByChannel(
        service,
        item.channel_type,
        item.channel_external_id,
        item.send_to,
        item.message
      )
    } catch (err) {
      console.error('[cron-recurring] error enviando', err)
    }

    await service.from('messages').insert({
      conversation_id: item.conversation_id,
      direction: 'outbound',
      sender: 'system',
      body: item.message,
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

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.chatventi.com').replace(/\/$/, '')

const dayLabel = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso)
  )

type OrgRow = {
  id: string
  name: string
  contact_email: string | null
  created_at: string
  trial_ends_at: string | null
  delete_scheduled_at: string | null
}

type FunnelSummary = { reminders: number; blocked: number; warnings: number; deleted: number }

/**
 * Funnel de la prueba gratis (sin tarjeta), corrido a diario:
 *   1. Recordatorio ~3 días antes de que termine la prueba.
 *   2. Al terminar: correo de "prueba terminada" + se agenda el borrado (día 30).
 *   3. Aviso ~4 días antes del borrado.
 *   4. Borrado de los datos operativos (se conserva la cuenta) + correo.
 * Todo salta a las orgs con suscripción activa. Idempotente por marcas de fecha.
 * Guardado por emailsEnabled(): si el SMTP no está activo, NO corre nada (no se
 * borra nada sin haber avisado por correo).
 */
async function runTrialFunnel(
  service: ReturnType<typeof createServiceClient>
): Promise<FunnelSummary> {
  const summary: FunnelSummary = { reminders: 0, blocked: 0, warnings: 0, deleted: 0 }
  if (!emailsEnabled()) return summary
  try {
    const now = new Date()
    const nowIso = now.toISOString()

    // Orgs con suscripción viva: quedan fuera del funnel.
    const { data: activeSubs } = await service
      .from('subscriptions')
      .select('organization_id')
      .in('status', ['trialing', 'active'])
    const activeOrgs = new Set((activeSubs ?? []).map((s) => s.organization_id))

    const cols = 'id, name, contact_email, created_at, trial_ends_at, delete_scheduled_at'

    // 1) Recordatorio: prueba termina dentro de ~3 días.
    const in3d = new Date(now.getTime() + 3 * 86400000).toISOString()
    const { data: ending } = await service
      .from('organizations')
      .select(cols)
      .is('data_deleted_at', null)
      .is('trial_ending_email_sent_at', null)
      .gt('trial_ends_at', nowIso)
      .lte('trial_ends_at', in3d)
    for (const o of (ending ?? []) as OrgRow[]) {
      if (!o.contact_email || activeOrgs.has(o.id)) continue
      const { subject, html } = trialEndingEmail({
        orgName: o.name,
        trialEndLabel: dayLabel(o.trial_ends_at as string),
        siteUrl: SITE,
      })
      await sendEmail({ to: o.contact_email, subject, html })
      await service.from('organizations').update({ trial_ending_email_sent_at: nowIso }).eq('id', o.id)
      summary.reminders++
    }

    // 2) Prueba terminada: correo de bloqueo + agenda el borrado (registro + 30d).
    const { data: ended } = await service
      .from('organizations')
      .select(cols)
      .is('data_deleted_at', null)
      .is('trial_ended_email_sent_at', null)
      .lt('trial_ends_at', nowIso)
    for (const o of (ended ?? []) as OrgRow[]) {
      if (activeOrgs.has(o.id)) continue
      const deleteIso = new Date(
        new Date(o.created_at).getTime() + DATA_RETENTION_DAYS * 86400000
      ).toISOString()
      if (o.contact_email) {
        const { subject, html } = trialEndedEmail({
          orgName: o.name,
          deleteLabel: dayLabel(deleteIso),
          siteUrl: SITE,
        })
        await sendEmail({ to: o.contact_email, subject, html })
      }
      await service
        .from('organizations')
        .update({ trial_ended_email_sent_at: nowIso, delete_scheduled_at: deleteIso })
        .eq('id', o.id)
      summary.blocked++
    }

    // 3) Aviso de borrado: faltan ~4 días.
    const in4d = new Date(now.getTime() + 4 * 86400000).toISOString()
    const { data: warn } = await service
      .from('organizations')
      .select(cols)
      .is('data_deleted_at', null)
      .is('deletion_warning_email_sent_at', null)
      .not('delete_scheduled_at', 'is', null)
      .gt('delete_scheduled_at', nowIso)
      .lte('delete_scheduled_at', in4d)
    for (const o of (warn ?? []) as OrgRow[]) {
      if (activeOrgs.has(o.id)) continue
      if (o.contact_email) {
        const { subject, html } = deletionWarningEmail({
          orgName: o.name,
          deleteLabel: dayLabel(o.delete_scheduled_at as string),
          siteUrl: SITE,
        })
        await sendEmail({ to: o.contact_email, subject, html })
      }
      await service.from('organizations').update({ deletion_warning_email_sent_at: nowIso }).eq('id', o.id)
      summary.warnings++
    }

    // 4) Borrado: llegó el día. Se borran los datos operativos; se conserva la cuenta.
    const { data: toDelete } = await service
      .from('organizations')
      .select(cols)
      .is('data_deleted_at', null)
      .not('delete_scheduled_at', 'is', null)
      .lte('delete_scheduled_at', nowIso)
    for (const o of (toDelete ?? []) as OrgRow[]) {
      if (activeOrgs.has(o.id)) continue
      const { error } = await service.rpc('wipe_organization_business_data', { p_org: o.id })
      if (error) {
        console.error('[cron-trial] wipe error', o.id, error.message)
        continue
      }
      if (o.contact_email) {
        const { subject, html } = dataDeletedEmail({ orgName: o.name, siteUrl: SITE })
        await sendEmail({ to: o.contact_email, subject, html })
      }
      summary.deleted++
    }
  } catch (e) {
    console.error('[cron-trial] error', e)
  }
  return summary
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
