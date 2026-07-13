import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConversationControls } from '@/features/agente-ia/components/conversation-controls'
import { MessageComposer } from '@/features/agente-ia/components/message-composer'

export const dynamic = 'force-dynamic'

const SENDER_LABEL: Record<string, string> = {
  contact: 'Cliente',
  ai: 'IA',
  agent: 'Tú',
  system: 'Sistema',
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
      .select('id, direction, sender, body, created_at')
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
                  {m.body}
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
