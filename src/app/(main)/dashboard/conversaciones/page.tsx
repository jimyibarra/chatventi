import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ConversationControls } from '@/features/agente-ia/components/conversation-controls'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Card } from '@/shared/components/ui/card'
import { ButtonLink } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { KpiCell } from '@/shared/components/ui/kpi-cell'
import { Avatar } from '@/shared/components/ui/avatar'
import { StatusChip } from '@/shared/components/ui/status-chip'
import { ChannelChip } from '@/shared/components/ui/channel'
import { fmtInt, timeAgo } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

// `pending`: la recepcionista se detuvo y espera a una persona (aprobación
// pendiente o respuesta rechazada). Es lo único de la lista que pide acción.
const STATUS_CHIP: Record<string, { tone: 'wait' | 'done'; label: string }> = {
  pending: { tone: 'wait', label: 'Te espera' },
  closed: { tone: 'done', label: 'Cerrada' },
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

/** Nota de la IA: lo que importa de un vistazo es dónde salió mal. */
function scoreTone(score: number): 'noshow' | 'neutral' | 'ok' {
  if (score <= 2) return 'noshow'
  if (score === 3) return 'neutral'
  return 'ok'
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
  const waiting = rows.filter((c) => c.status === 'pending').length
  const now = new Date()

  return (
    <Page>
      <PageHeader
        title="Chats"
        subtitle={
          rows.length === 0
            ? 'Lo que te escriben tus clientes, en un solo lugar.'
            : `${fmtInt(rows.length)} ${rows.length === 1 ? 'conversación' : 'conversaciones'}, la más reciente arriba${
                waiting ? ` · ${fmtInt(waiting)} ${waiting === 1 ? 'te espera' : 'te esperan'}` : ''
              }.`
        }
        actions={
          <ButtonLink href="/dashboard/agente/probar" variant="secondary">
            Probar la recepcionista
          </ButtonLink>
        }
      />

      {(scored.length > 0 || csatScores.length > 0) && (
        <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {scored.length > 0 && (
            <KpiCell
              label="Calidad de la atención (IA)"
              value={avg(scored)}
              unit="/ 5"
              hint={`${fmtInt(scored.length)} conversaciones calificadas`}
            />
          )}
          {csatScores.length > 0 && (
            <KpiCell
              label="Lo que dicen tus clientes"
              value={avg(csatScores)}
              unit="/ 5"
              hint={`${fmtInt(csatScores.length)} respuestas`}
            />
          )}
          {malas > 0 && (
            <KpiCell
              tone="danger"
              label="Salieron mal"
              value={fmtInt(malas)}
              hint="Conviene revisarlas"
              // En celular, la tercera cifra ocupa la fila entera en vez de quedar coja.
              className={scored.length > 0 && csatScores.length > 0 ? 'col-span-2 md:col-span-1' : ''}
            />
          )}
        </dl>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="chat"
          title="Aquí vivirán tus chats"
          action={<ButtonLink href="/dashboard/conexiones">Conectar WhatsApp</ButtonLink>}
        >
          Cuando un cliente te escriba por WhatsApp o Telegram, su conversación aparece aquí y tu
          recepcionista IA la atiende por ti. Tú entras cuando quieras, o cuando ella te lo pida.
        </EmptyState>
      ) : (
        <Card padded={false} className="px-4 py-1 md:px-5">
          <ul className="divide-y divide-line">
            {rows.map((c) => {
              const name = c.client?.name || c.client?.phone || 'Cliente'
              const chip = STATUS_CHIP[c.status]
              const bad = typeof c.ai_score === 'number' && c.ai_score <= 2
              return (
                <li key={c.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3.5">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1 basis-[13rem]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/dashboard/conversaciones/${c.id}`}
                        className="min-w-0 truncate rounded-[6px] text-[15px] font-semibold text-ink after:absolute after:inset-0 after:rounded-[14px] after:content-[''] hover:underline"
                      >
                        {name}
                      </Link>
                      {chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
                      <ChannelChip type={c.channel?.type} />
                      {c.last_message_at && (
                        <span className="tabular-nums">{timeAgo(c.last_message_at, now)}</span>
                      )}
                      {typeof c.ai_score === 'number' && (
                        <StatusChip tone={scoreTone(c.ai_score)} title={c.ai_score_reason ?? undefined}>
                          Atención {c.ai_score}/5
                        </StatusChip>
                      )}
                    </div>
                    {bad && c.ai_score_reason && (
                      <p className="mt-1.5 max-w-[70ch] text-[13px] leading-snug text-[#a51b18]">{c.ai_score_reason}</p>
                    )}
                  </div>
                  <div className="relative z-[1] w-full sm:ml-auto sm:w-auto">
                    <ConversationControls
                      conversationId={c.id}
                      aiEnabled={c.ai_enabled}
                      aiPausedUntil={c.ai_paused_until}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </Page>
  )
}
