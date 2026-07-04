import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendToCustomerByChannel } from '@/features/agente-ia/senders'

export const runtime = 'nodejs'

type DueItem = {
  appointment_id: string
  conversation_id: string
  channel_type: string
  channel_external_id: string
  send_to: string
  starts_at: string
  tz: string
  org_name: string
  client_name: string | null
  service_names: string | null
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
    return `Hola${name}, te recordamos tu cita${svc} en ${item.org_name} el ${whenLabel(
      item.starts_at,
      item.tz
    )}. Si necesitas reagendar o cancelar, respóndenos por aquí. ¡Te esperamos!`
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
  const summary: Record<Kind, { sent: number; skipped: number }> = {
    '24h': { sent: 0, skipped: 0 },
    '2h': { sent: 0, skipped: 0 },
    followup: { sent: 0, skipped: 0 },
  }

  for (const kind of kinds) {
    const { data, error } = await service.rpc('get_due_reminders', { p_kind: kind })
    if (error) {
      console.error(`[cron-reminders] get_due_reminders(${kind}) error`, error.message)
      continue
    }
    const items = (data as unknown as DueItem[]) ?? []

    for (const item of items) {
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
        extId = await sendToCustomerByChannel(
          service,
          item.channel_type,
          item.channel_external_id,
          item.send_to,
          text
        )
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

  return NextResponse.json({ ok: true, summary })
}
