import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConversationControls } from '@/features/agente-ia/components/conversation-controls'
import { MessageComposer } from '@/features/agente-ia/components/message-composer'
import { signInboundUrl } from '@/features/storage/inbound'

export const dynamic = 'force-dynamic'

const SENDER_LABEL: Record<string, string> = {
  contact: 'Cliente',
  ai: 'IA',
  agent: 'Tú',
  system: 'Sistema',
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
    return <p className="mb-1 text-xs italic opacity-70">Archivo adjunto (no se pudo abrir)</p>
  }
  if (mime?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y
            efímera: next/image la cachearía con una firma ya caducada. */}
        <img src={url} alt="Archivo enviado por el cliente" className="max-h-64 rounded-xl" />
      </a>
    )
  }
  if (mime?.startsWith('audio/')) {
    return <audio controls src={url} className="mb-1 w-full max-w-64" />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mb-1 block underline">
      📎 Abrir archivo
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
    <>
      <div className="mx-auto max-w-2xl p-6">
        <Link
          href="/dashboard/conversaciones"
          className="mb-3 inline-block text-sm text-ink-soft hover:text-ink"
        >
          ← Conversaciones
        </Link>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-ink">
              {client?.name || client?.phone || 'Cliente'}
            </h1>
            <p className="text-xs text-ink-soft">{channel?.type ?? '—'}</p>
          </div>
          <ConversationControls
            conversationId={conv.id}
            aiEnabled={conv.ai_enabled}
            aiPausedUntil={conv.ai_paused_until}
          />
        </div>

        {(approvals ?? []).some((a) => a.status === 'pending') && (
          <div className="mb-4 rounded-xl border border-warn-bg bg-warn-bg p-3 text-sm text-warn">
            Hay una respuesta esperando aprobación por Telegram.
          </div>
        )}

        <div className="space-y-2 rounded-card border border-line bg-white p-4">
          {(messages ?? []).length === 0 ? (
            <p className="text-sm text-ink-faint">Sin mensajes.</p>
          ) : (
            (messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    m.direction === 'outbound'
                      ? 'bg-brand-600 text-white'
                      : 'bg-line-soft text-ink-muted'
                  }`}
                >
                  <p className="mb-0.5 text-[10px] uppercase opacity-70">
                    {SENDER_LABEL[m.sender] ?? m.sender}
                  </p>
                  <MessageMedia
                    mime={m.media_mime}
                    url={signedByMessage.get(m.id) ?? null}
                    hasFile={Boolean(m.media_path)}
                  />
                  {m.body}
                  {m.media_text && (
                    // Lo que la IA leyó del archivo. Se muestra para que el
                    // dueño pueda juzgar si la lectura fue correcta.
                    <p className="mt-1 border-l-2 border-current/30 pl-2 text-xs italic opacity-80">
                      {m.media_text}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <MessageComposer conversationId={conv.id} />

        {(approvals ?? []).length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-muted">Historial de aprobaciones</h2>
            <ul className="space-y-1">
              {(approvals ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border border-line bg-white p-2 text-xs">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 ${
                      a.status === 'approved'
                        ? 'bg-success-bg text-success'
                        : a.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-warn-bg text-warn'
                    }`}
                  >
                    {a.status}
                  </span>
                  <span className="text-ink-muted">{a.draft}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}
