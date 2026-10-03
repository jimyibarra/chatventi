import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConversationControls } from '@/features/agente-ia/components/conversation-controls'
import { MessageComposer } from '@/features/agente-ia/components/message-composer'
import { signInboundUrl } from '@/features/storage/inbound'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Card, Section } from '@/shared/components/ui/card'
import { Notice } from '@/shared/components/ui/notice'
import { Avatar } from '@/shared/components/ui/avatar'
import { Icon } from '@/shared/components/ui/icon'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { ChannelChip } from '@/shared/components/ui/channel'
import { fmtShortDate, fmtTime } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

const SENDER_LABEL: Record<string, string> = {
  contact: 'Cliente',
  ai: 'IA',
  agent: 'Tú',
  system: 'Sistema',
}

const APPROVAL_CHIP: Record<string, { tone: ChipTone; label: string }> = {
  pending: { tone: 'wait', label: 'Esperando' },
  approved: { tone: 'ok', label: 'Aprobada' },
  rejected: { tone: 'noshow', label: 'Rechazada' },
}

/** Clave de día en la hora de México, para separar el hilo por días. */
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(iso))
}

function dayLabel(iso: string, now: Date): string {
  const k = dayKey(iso)
  if (k === dayKey(now.toISOString())) return 'Hoy'
  if (k === dayKey(new Date(now.getTime() - 86400000).toISOString())) return 'Ayer'
  return fmtShortDate(iso)
}

/**
 * Archivo que mandó el cliente. La imagen se muestra y el audio se escucha en
 * la propia conversación; lo demás (PDF) queda como enlace. `hasFile` sin
 * `url` significa que la firma falló: se avisa en vez de no mostrar nada.
 */
function MessageMedia({
  mime,
  url,
  hasFile,
}: {
  mime: string | null
  url: string | null
  hasFile: boolean
}) {
  if (!hasFile) return null
  if (!url) {
    return <p className="mb-1.5 text-[13px] italic opacity-80">Archivo adjunto (no se pudo abrir)</p>
  }
  if (mime?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y
            efímera: next/image la cachearía con una firma ya caducada. */}
        <img src={url} alt="Archivo enviado por el cliente" className="max-h-64 rounded-[12px]" />
      </a>
    )
  }
  if (mime?.startsWith('audio/')) {
    return <audio controls src={url} className="mb-1.5 w-full max-w-64" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
    >
      <Icon name="paperclip" className="h-4 w-4" />
      Abrir archivo
    </a>
  )
}

export default async function ConversacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select(
      `id, status, ai_enabled, ai_paused_until,
       client:clients(name, phone), channel:channels(type)`
    )
    .eq('id', id)
    .maybeSingle()

  if (!conv) notFound()

  const [{ data: messages }, { data: approvals }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, direction, sender, body, created_at, media_path, media_mime, media_text')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('ai_approvals')
      .select('id, draft, status, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false }),
  ])

  const client = (conv.client as { name: string | null; phone: string | null } | null) ?? null
  const channel = (conv.channel as { type: string } | null) ?? null
  const name = client?.name || client?.phone || 'Cliente'
  const now = new Date()

  // Los archivos que manda el cliente viven en un bucket PRIVADO: se ven solo
  // por URL firmada, que caduca a los 5 minutos. Se firman aquí, en el
  // servidor, no en el navegador.
  const signedByMessage = new Map<string, string>()
  await Promise.all(
    (messages ?? [])
      .filter((m) => m.media_path)
      .map(async (m) => {
        const url = await signInboundUrl(m.media_path as string)
        if (url) signedByMessage.set(m.id, url)
      })
  )

  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: '/dashboard/conversaciones', label: 'Chats' }}
        lead={<Avatar name={name} size="lg" />}
        title={name}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <ChannelChip type={channel?.type} />
            {client?.name && client.phone && <span className="tabular-nums">{client.phone}</span>}
          </span>
        }
      />

      <div className="mb-4">
        <ConversationControls
          conversationId={conv.id}
          aiEnabled={conv.ai_enabled}
          aiPausedUntil={conv.ai_paused_until}
        />
      </div>

      {(approvals ?? []).some((a) => a.status === 'pending') && (
        <Notice tone="action" className="mb-4" title="Hay una respuesta esperando aprobación por Telegram">
          La recepcionista no vuelve a contestar este chat hasta que la apruebes o la rechaces.
        </Notice>
      )}

      <Card padded={false} className="overflow-hidden">
        {/* flex-col-reverse: el hilo abre ya desplazado hasta el último mensaje. */}
        <div className="flex max-h-[min(64vh,680px)] min-h-[240px] flex-col-reverse overflow-y-auto bg-[#f6f7fc] px-3 py-4 md:px-5">
          <div className="space-y-2.5" data-testid="chat-thread">
            {(messages ?? []).length === 0 ? (
              <p className="py-10 text-center text-[15px] text-ink-muted">Todavía no hay mensajes en este chat.</p>
            ) : (
              (messages ?? []).map((m, i, all) => {
                const out = m.direction === 'outbound'
                const showDay = i === 0 || dayKey(all[i - 1].created_at) !== dayKey(m.created_at)
                if (m.sender === 'system') {
                  return (
                    <div key={m.id}>
                      {showDay && <DaySeparator label={dayLabel(m.created_at, now)} />}
                      <p className="mx-auto w-fit max-w-[85%] rounded-full bg-[#e7e6f0] px-3 py-1 text-center text-[12.5px] text-ink-muted">
                        {m.body}
                      </p>
                    </div>
                  )
                }
                const bubble = !out
                  ? 'rounded-[18px_18px_18px_6px] bg-white text-ink shadow-[0_1px_0_#dde2f0]'
                  : m.sender === 'agent'
                    ? 'rounded-[18px_18px_6px_18px] bg-ink text-white'
                    : 'rounded-[18px_18px_6px_18px] bg-brand-500 text-white'
                return (
                  <div key={m.id}>
                    {showDay && <DaySeparator label={dayLabel(m.created_at, now)} />}
                    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 text-[15px] leading-relaxed md:max-w-[75%] ${bubble}`}>
                        <p className={`mb-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold ${out ? 'text-white/80' : 'text-ink-muted'}`}>
                          {m.sender === 'ai' && <Icon name="robot" className="h-3.5 w-3.5" />}
                          {SENDER_LABEL[m.sender] ?? m.sender}
                          <span className="font-normal tabular-nums">· {fmtTime(m.created_at)}</span>
                        </p>
                        <MessageMedia
                          mime={m.media_mime}
                          url={signedByMessage.get(m.id) ?? null}
                          hasFile={Boolean(m.media_path)}
                        />
                        <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</span>
                        {m.media_text && (
                          // Lo que la IA leyó del archivo. Se muestra para que el
                          // dueño pueda juzgar si la lectura fue correcta.
                          <p className={`mt-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] leading-snug ${out ? 'bg-white/15' : 'bg-surface text-ink-muted'}`}>
                            <b className="font-semibold">La IA leyó: </b>
                            {m.media_text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <MessageComposer conversationId={conv.id} />
      </Card>

      {(approvals ?? []).length > 0 && (
        <Section title="Historial de aprobaciones" className="mt-4" description="Respuestas de la recepcionista que pasaron por tu visto bueno.">
          <ul className="divide-y divide-line">
            {(approvals ?? []).map((a) => {
              const chip = APPROVAL_CHIP[a.status] ?? { tone: 'neutral' as const, label: a.status }
              return (
                <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0">
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  <p className="min-w-0 flex-1 basis-[16rem] text-[14.5px] leading-snug text-ink">{a.draft}</p>
                  <span className="text-[13px] tabular-nums text-ink-muted">{fmtShortDate(a.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </Page>
  )
}

function DaySeparator({ label }: { label: string }) {
  return (
    <p className="my-3 flex items-center gap-3 text-[12px] font-semibold text-ink-muted before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
      {label}
    </p>
  )
}
