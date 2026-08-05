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
  ai_score: number | null
  ai_score_reason: string | null
  client: { name: string | null; phone: string | null } | null
  channel: { type: string; external_id: string } | null
}

/** Media con un decimal. */
function avg(values: number[]): string {
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
}

/** Color por nota: lo que importa de un vistazo es dónde salió mal. */
function scoreTone(score: number): string {
  if (score <= 2) return 'bg-rose-100 text-rose-700'
  if (score === 3) return 'bg-warn-bg text-warn'
  return 'bg-success-bg text-success'
}

export default async function ConversacionesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('conversations')
    .select(
      `id, status, ai_enabled, ai_paused_until, last_message_at, ai_score, ai_score_reason,
       client:clients(name, phone), channel:channels(type, external_id)`
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  // Cómo va la atención. Ambas cifras salen de capacidades opcionales: si
  // están apagadas no hay datos y la franja no se pinta.
  const { data: csat } = await supabase.from('csat_responses').select('score').limit(500)

  // Excluye el hilo del sandbox "Prueba el Chat IA" (canal web sandbox:<orgId>):
  // es una conversación de práctica del dueño, no un chat de cliente real.
  const rows = ((data as Row[] | null) ?? []).filter(
    (c) => !c.channel?.external_id?.startsWith('sandbox:')
  )

  const scored = rows.map((c) => c.ai_score).filter((s): s is number => typeof s === 'number')
  const csatScores = ((csat as { score: number }[] | null) ?? []).map((r) => r.score)
  const malas = scored.filter((s) => s <= 2).length

  return (
    <>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-4 text-xl font-bold text-ink">Conversaciones</h1>

        {(scored.length > 0 || csatScores.length > 0) && (
          <div className="mb-4 flex flex-wrap gap-3">
            {scored.length > 0 && (
              <div className="rounded-card border border-line bg-white px-4 py-3">
                <p className="text-xs text-ink-soft">Calidad de la atención (IA)</p>
                <p className="text-lg font-bold text-ink">
                  {avg(scored)} <span className="text-sm font-normal text-ink-soft">/ 5</span>
                </p>
                <p className="text-xs text-ink-faint">{scored.length} conversaciones</p>
              </div>
            )}
            {csatScores.length > 0 && (
              <div className="rounded-card border border-line bg-white px-4 py-3">
                <p className="text-xs text-ink-soft">Lo que dicen tus clientes</p>
                <p className="text-lg font-bold text-ink">
                  {avg(csatScores)} <span className="text-sm font-normal text-ink-soft">/ 5</span>
                </p>
                <p className="text-xs text-ink-faint">{csatScores.length} respuestas</p>
              </div>
            )}
            {malas > 0 && (
              <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-xs text-rose-700">Salieron mal</p>
                <p className="text-lg font-bold text-rose-700">{malas}</p>
                <p className="text-xs text-rose-600">conviene revisarlas</p>
              </div>
            )}
          </div>
        )}

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
                    {typeof c.ai_score === 'number' && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 font-medium ${scoreTone(c.ai_score)}`}
                        title={c.ai_score_reason ?? undefined}
                      >
                        {c.ai_score}/5
                      </span>
                    )}
                  </p>
                  {typeof c.ai_score === 'number' && c.ai_score <= 2 && c.ai_score_reason && (
                    <p className="mt-0.5 text-xs text-rose-700">{c.ai_score_reason}</p>
                  )}
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
