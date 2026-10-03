import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientDetail } from '@/features/crm/components/client-detail'
import { ClientFiles } from '@/features/expediente/components/client-files'
import { ClientRecords } from '@/features/expediente/components/client-records'
import { ClientReminders } from '@/features/expediente/components/client-reminders'
import type {
  ClientFile,
  ClientRecord,
  ClientReminder,
} from '@/features/expediente/types'
import { apptChip } from '@/features/lineas/status'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { ButtonLink } from '@/shared/components/ui/button'
import { Avatar } from '@/shared/components/ui/avatar'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip } from '@/shared/components/ui/status-chip'
import { ChannelChip } from '@/shared/components/ui/channel'
import { fmtDateTime, fmtInt, fmtTime } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

type Tag = { id: string; name: string; color: string }

const TZ = 'America/Mexico_City'

/** Bloque de fecha de una cita: día grande y mes corto, como una estación. */
function DateBlock({ iso, upcoming }: { iso: string; upcoming: boolean }) {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: TZ }).format(d)
  const month = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: TZ }).format(d).replace('.', '')
  return (
    <span
      className={`grid h-[50px] w-[50px] flex-none content-center justify-items-center rounded-[13px] leading-none ${
        upcoming ? 'bg-brand-500 text-white' : 'bg-surface text-ink'
      }`}
    >
      <b className="text-[19px] font-bold tabular-nums">{day}</b>
      <span className={`mt-1 text-[11.5px] font-semibold ${upcoming ? 'text-white/85' : 'text-ink-muted'}`}>{month}</span>
    </span>
  )
}

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, phone, notes')
    .eq('id', id)
    .maybeSingle()

  // Los contactos internos del sandbox (handle sandbox:<userId>) no son
  // clientes reales: su ficha no debe ser accesible desde el CRM.
  if (!client || client.phone?.startsWith('sandbox:')) notFound()

  const [
    { data: allTags },
    { data: assigned },
    { data: appointments },
    { data: conversations },
    { data: orgId },
    { data: files },
    { data: records },
    { data: reminders },
  ] = await Promise.all([
    supabase.from('tags').select('id, name, color').order('name'),
    supabase.from('client_tags').select('tag_id').eq('client_id', id),
    supabase
      .from('appointments')
      .select('id, starts_at, status, appointment_services(service:service_catalogs(name))')
      .eq('client_id', id)
      .order('starts_at', { ascending: false })
      .limit(50),
    supabase
      .from('conversations')
      .select('id, status, last_message_at, channel:channels(type)')
      .eq('client_id', id)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase.rpc('get_my_org'),
    supabase
      .from('client_files')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_records')
      .select('*')
      .eq('client_id', id)
      .order('occurred_at', { ascending: false })
      .limit(100),
    supabase
      .from('client_reminders')
      .select('*')
      .eq('client_id', id)
      .order('next_due_at'),
  ])

  const assignedIds = ((assigned as { tag_id: string }[] | null) ?? []).map((a) => a.tag_id)

  type ApptRow = {
    id: string
    starts_at: string
    status: string
    appointment_services: { service: { name: string } | null }[] | null
  }
  type ConvRow = {
    id: string
    status: string
    last_message_at: string | null
    channel: { type: string } | null
  }

  const appts = (appointments as ApptRow[] | null) ?? []
  const convs = (conversations as ConvRow[] | null) ?? []
  const name = client.name || client.phone || 'Cliente'
  const now = new Date()
  const isUpcoming = (a: ApptRow) =>
    new Date(a.starts_at) > now && (a.status === 'scheduled' || a.status === 'confirmed')

  return (
    <Page width="wide">
      <PageHeader
        back={{ href: '/dashboard/clientes', label: 'Clientes' }}
        lead={<Avatar name={name} size="lg" />}
        title={name}
        subtitle={
          <>
            {client.name && client.phone && <span className="tabular-nums">{client.phone} · </span>}
            {fmtInt(appts.length)} {appts.length === 1 ? 'cita' : 'citas'} · {fmtInt(convs.length)}{' '}
            {convs.length === 1 ? 'conversación' : 'conversaciones'}
          </>
        }
        actions={
          convs[0] ? (
            <ButtonLink href={`/dashboard/conversaciones/${convs[0].id}`} variant="secondary">
              <Icon name="chat" />
              Abrir su chat
            </ButtonLink>
          ) : undefined
        }
      />

      {/* Celular: ficha → citas y chats → expediente. Computadora: el
          expediente a la izquierda y citas y chats en una columna a la derecha. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 [grid-template-areas:'ficha'_'aside'_'main'] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'ficha_aside'_'main_aside']">
        <div className="min-w-0 [grid-area:ficha]">
          <ClientDetail
            client={client}
            allTags={(allTags as Tag[] | null) ?? []}
            assignedTagIds={assignedIds}
          />
        </div>

        <div className="min-w-0 space-y-4 [grid-area:aside]">
          <Section title="Citas" badge={appts.length > 0 ? <StatusChip>{fmtInt(appts.length)}</StatusChip> : undefined}>
            {appts.length === 0 ? (
              <p className="text-[14.5px] text-ink-muted">Todavía no ha tenido citas.</p>
            ) : (
              <ul className="divide-y divide-line">
                {appts.map((a) => {
                  const chip = apptChip(a.status)
                  const services = (a.appointment_services ?? [])
                    .map((s) => s.service?.name)
                    .filter(Boolean)
                    .join(', ')
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <DateBlock iso={a.starts_at} upcoming={isUpcoming(a)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] text-ink" title={fmtDateTime(a.starts_at)}>
                          <b className="font-bold tabular-nums">{fmtTime(a.starts_at)}</b> · {services || 'Cita'}
                        </p>
                        <StatusChip tone={chip.tone} className="mt-1">
                          {chip.label}
                        </StatusChip>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section title="Conversaciones">
            {convs.length === 0 ? (
              <p className="text-[14.5px] text-ink-muted">Todavía no te ha escrito por ningún canal.</p>
            ) : (
              <ul className="divide-y divide-line">
                {convs.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <ChannelChip type={c.channel?.type} />
                      {c.last_message_at && (
                        <p className="mt-1 text-[13px] tabular-nums text-ink-muted">Último mensaje: {fmtDateTime(c.last_message_at)}</p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/conversaciones/${c.id}`}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-[11px] px-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                      data-testid="open-conversation"
                    >
                      Abrir chat
                      <Icon name="arrowRight" className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-4 [grid-area:main]">
          <ClientRecords clientId={id} records={(records as ClientRecord[] | null) ?? []} />

          <ClientReminders
            clientId={id}
            reminders={(reminders as ClientReminder[] | null) ?? []}
            canReach={convs.length > 0}
          />

          {orgId && (
            <ClientFiles
              clientId={id}
              orgId={orgId as string}
              files={(files as ClientFile[] | null) ?? []}
            />
          )}
        </div>
      </div>
    </Page>
  )
}
