import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AutoRefresh, EtaForm, OrderActions } from '@/features/pedidos/components/order-actions'
import { ORDER_STATUS_LABEL, type OrderItem, type OrderStatus } from '@/features/pedidos/parse'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { StatusChip, type ChipTone } from '@/shared/components/ui/status-chip'
import { fmtTime, timeAgo } from '@/shared/lib/format'

export const dynamic = 'force-dynamic'

// Tablero de pedidos por WhatsApp (fase 2, 17-oct-2026): es la «agenda» de un
// restaurante. Los pedidos los crea el webhook al reconocer el mensaje del
// carrito; aquí solo se leen (RLS) y se avanzan con acciones del servidor.

type Row = {
  id: string
  status: OrderStatus
  customer_name: string | null
  items: OrderItem[]
  total_text: string | null
  delivery_mode: 'pickup' | 'delivery'
  address: string | null
  notes: string | null
  conversation_id: string | null
  created_at: string
  updated_at: string
  ready_notified_at: string | null
  client: { phone: string | null } | null
}

const COLUMNS: { status: OrderStatus; title: string; tone: ChipTone }[] = [
  { status: 'new', title: 'Nuevos', tone: 'wait' },
  { status: 'preparing', title: 'En preparación', tone: 'brand' },
  { status: 'ready', title: 'Listos', tone: 'ok' },
]

/** Página del servidor: se pinta en cada visita, así que «ahora» es la hora de la petición. */
function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

export default async function PedidosPage() {
  const supabase = await createClient()
  const since = hoursAgoIso(24)
  const [{ data }, { data: { user } }, { data: org }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, customer_name, items, total_text, delivery_mode, address, notes, conversation_id, created_at, updated_at, ready_notified_at, client:clients(phone)')
      .or(`status.in.(new,preparing,ready),updated_at.gte.${since}`)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase.auth.getUser(),
    supabase.from('organizations').select('order_eta_minutes').maybeSingle(),
  ])
  const { data: me } = user ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() : { data: null }
  const canManage = me?.role === 'owner' || me?.role === 'manager'
  const rows = (data ?? []) as unknown as Row[]
  const closed = rows.filter((r) => r.status === 'delivered' || r.status === 'cancelled').reverse()

  return (
    <Page width="wide">
      <AutoRefresh />
      <PageHeader
        title="Pedidos"
        subtitle="Los pedidos que llegan por WhatsApp desde tu página. Muévelos conforme avanzan: al marcar «Listo», tu cliente recibe el aviso."
      />
      {canManage && (
        <div className="mb-4">
          <EtaForm minutes={org?.order_eta_minutes ?? 30} />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="bell" title="Todavía no hay pedidos">
          Cuando un cliente arme su pedido en tu página y lo mande por WhatsApp, aparece aquí al instante y tu recepcionista le confirma el tiempo de entrega.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="orders-board">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => r.status === col.status)
            return (
              <section key={col.status} aria-labelledby={`col-${col.status}`} className="min-w-0 rounded-[18px] bg-surface p-3">
                <h2 id={`col-${col.status}`} className="mb-3 flex items-center gap-2 px-1 text-[15px] font-bold text-ink">
                  {col.title}
                  <StatusChip tone={col.tone}>{list.length}</StatusChip>
                </h2>
                <div className="space-y-3">
                  {list.length === 0 && <p className="px-1 text-[14px] text-ink-muted">Nada por aquí.</p>}
                  {list.map((o) => (
                    <OrderCard key={o.id} o={o} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {closed.length > 0 && (
        <section className="mt-6" aria-labelledby="col-closed">
          <h2 id="col-closed" className="mb-2 text-[15px] font-bold text-ink">
            Últimas 24 horas
          </h2>
          <ul className="divide-y divide-line rounded-[18px] bg-white px-4 shadow-[0_1px_0_#dde2f0]">
            {closed.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[14px]">
                <StatusChip tone={o.status === 'delivered' ? 'done' : 'noshow'}>{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                <span className="font-semibold text-ink">{o.customer_name ?? o.client?.phone ?? 'Cliente'}</span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</span>
                <span className="tabular-nums text-ink-muted">{fmtTime(o.updated_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  )
}

function OrderCard({ o }: { o: Row }) {
  return (
    <article className="rounded-[14px] bg-white p-3.5 shadow-[0_1px_0_#dde2f0]" data-testid="order-card">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-[15.5px] font-bold text-ink">{o.customer_name ?? 'Cliente'}</p>
        <p className="text-[12.5px] tabular-nums text-ink-muted">
          {fmtTime(o.created_at)} · {timeAgo(o.created_at)}
        </p>
      </header>
      <ul className="space-y-0.5 text-[14.5px] text-ink">
        {o.items.map((i, n) => (
          <li key={n}>
            <b className="tabular-nums">{i.qty} ×</b> {i.name}
            {i.priceText && <span className="text-ink-muted"> ({i.priceText})</span>}
          </li>
        ))}
      </ul>
      {o.total_text && <p className="mt-1.5 text-[14px] font-semibold text-ink">Total: {o.total_text}</p>}
      <p className="mt-1.5 text-[13.5px] text-ink-muted">
        {o.delivery_mode === 'delivery' ? <>🛵 A domicilio: {o.address}</> : <>🛍️ Pasa a recogerlo</>}
      </p>
      {o.notes && <p className="mt-1 rounded-[10px] bg-surface px-2.5 py-1.5 text-[13.5px] text-ink">Notas: {o.notes}</p>}
      {o.status === 'ready' && o.ready_notified_at && <p className="mt-1.5 text-[12.5px] text-ink-muted">Cliente avisado ✓</p>}
      <OrderActions orderId={o.id} status={o.status} />
      {o.conversation_id && (
        <Link href={`/dashboard/conversaciones/${o.conversation_id}`} className="mt-2 inline-flex min-h-[40px] items-center text-[13.5px] font-semibold text-brand-800 underline underline-offset-2">
          Ver chat{o.client?.phone ? ` · ${o.client.phone}` : ''}
        </Link>
      )}
    </article>
  )
}
