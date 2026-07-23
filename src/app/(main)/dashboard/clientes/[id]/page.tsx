import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientDetail } from '@/features/crm/components/client-detail'
import { STATUS_META, type AppointmentStatus } from '@/features/agenda/types'

export const dynamic = 'force-dynamic'

type Tag = { id: string; name: string; color: string }

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
    hourCycle: 'h23',
  }).format(new Date(iso))
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

  const [{ data: allTags }, { data: assigned }, { data: appointments }, { data: conversations }] =
    await Promise.all([
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

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Link
          href="/dashboard/clientes"
          className="inline-block text-sm text-ink-soft hover:text-ink"
        >
          ← Clientes
        </Link>
        <h1 className="text-xl font-bold text-ink">
          {client.name || client.phone || 'Cliente'}
        </h1>

        <ClientDetail
          client={client}
          allTags={(allTags as Tag[] | null) ?? []}
          assignedTagIds={assignedIds}
        />

        <section className="rounded-card border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Historial de citas</h2>
          {appts.length === 0 ? (
            <p className="text-sm text-ink-faint">Sin citas.</p>
          ) : (
            <ul className="divide-y divide-line-row">
              {appts.map((a) => {
                const meta = STATUS_META[a.status as AppointmentStatus]
                const services = (a.appointment_services ?? [])
                  .map((s) => s.service?.name)
                  .filter(Boolean)
                  .join(', ')
                return (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-muted">
                      {fmtDateTime(a.starts_at)}
                      {services ? ` · ${services}` : ''}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${meta?.badge ?? ''}`}>
                      {meta?.label ?? a.status}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Conversaciones</h2>
          {convs.length === 0 ? (
            <p className="text-sm text-ink-faint">Sin conversaciones.</p>
          ) : (
            <ul className="divide-y divide-line-row">
              {convs.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-muted">
                    {c.channel?.type ?? '—'}
                    {c.last_message_at ? ` · ${fmtDateTime(c.last_message_at)}` : ''}
                  </span>
                  <Link
                    href={`/dashboard/conversaciones/${c.id}`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                    data-testid="open-conversation"
                  >
                    Abrir chat →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
