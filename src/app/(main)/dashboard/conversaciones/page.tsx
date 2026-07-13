import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ConversationControls } from '@/features/agente-ia/components/conversation-controls'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta',
  pending: 'Pendiente',
  closed: 'Cerrada',
}

type Row = {
  id: string
  status: string
  ai_enabled: boolean
  ai_paused_until: string | null
  last_message_at: string | null
  client: { name: string | null; phone: string | null } | null
  channel: { type: string } | null
}

export default async function ConversacionesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('conversations')
    .select(
      `id, status, ai_enabled, ai_paused_until, last_message_at,
       client:clients(name, phone), channel:channels(type)`
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const rows = (data as Row[] | null) ?? []

  return (
    <>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-4 text-xl font-bold text-ink">Conversaciones</h1>

        {rows.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
            <p className="font-medium text-ink-muted">Aquí vivirán tus chats 💬</p>
            <p className="mt-1">
              Cuando un cliente te escriba por WhatsApp o Telegram, su conversación aparecerá
              aquí y tu recepcionista IA podrá atenderla por ti.
            </p>
            <a
              href="/dashboard/conexiones"
              className="mt-3 inline-block rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600"
            >
              Conectar WhatsApp
            </a>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/conversaciones/${c.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {c.client?.name || c.client?.phone || 'Cliente'}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {c.channel?.type ?? '—'} · {STATUS_LABEL[c.status] ?? c.status}
                  </p>
                </div>
                <ConversationControls
                  conversationId={c.id}
                  aiEnabled={c.ai_enabled}
                  aiPausedUntil={c.ai_paused_until}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
