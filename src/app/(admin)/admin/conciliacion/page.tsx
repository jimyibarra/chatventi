import type { Metadata } from 'next'
import { getStripeSnapshot } from '@/features/admin/stripe-reconcile'
import { AdminTable, NUM, STICKY, TD, TH, TR } from '@/features/admin/components/admin-table'
import { STATUS_LABELS } from '@/features/billing/plans'
import { EmptyState, KpiCell, Notice, Page, PageHeader, StatusChip } from '@/shared/components/ui'
import { fmtMoney } from '@/shared/lib/format'

export const metadata: Metadata = { title: 'Super Admin · Conciliación' }
export const dynamic = 'force-dynamic'

const status = (s: string | null) => (s ? (STATUS_LABELS[s] ?? s) : '—')

/** ChatVenti contra Stripe: ingreso real, lo cobrado en el mes y cada suscripción que no cuadra. */
export default async function AdminConciliacionPage() {
  const snap = await getStripeSnapshot()
  const month = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(new Date())
  const differences = snap.rows.filter((r) => r.issues.length > 0)

  return (
    <Page width="wide">
      <PageHeader
        title="Conciliación con Stripe"
        subtitle="Stripe es la fuente de verdad del cobro. Aquí se compara cada suscripción de Stripe con lo que ChatVenti tiene registrado de ese negocio."
        actions={
          snap.mode === 'test' ? (
            <StatusChip tone="wait" size="md">Stripe en modo prueba: no es dinero real</StatusChip>
          ) : (
            <StatusChip tone="ok" size="md">Stripe en modo real</StatusChip>
          )
        }
      />

      {snap.error && (
        <Notice tone="danger" className="mb-5">
          {snap.error}
        </Notice>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCell label="Ingreso mensual en pesos" value={fmtMoney(snap.mrr.mxn)} unit="MXN" hint="Suscripciones vivas, sin IVA" testId="rec-mrr-mxn" />
        <KpiCell label="Ingreso mensual en dólares" value={fmtMoney(snap.mrr.usd)} unit="USD" hint="El anual, repartido en 12 meses" testId="rec-mrr-usd" />
        <KpiCell label={`Cobrado en ${month}`} value={fmtMoney(snap.paidThisMonth.mxn)} unit="MXN" hint="Facturas pagadas, sin IVA" />
        <KpiCell label={`Cobrado en ${month}`} value={fmtMoney(snap.paidThisMonth.usd)} unit="USD" hint="Facturas pagadas" />
      </dl>

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[1.15rem] font-bold leading-tight text-ink">Suscripciones</h2>
        {differences.length === 0 ? (
          <StatusChip tone="ok" testId="rec-ok">Todo cuadra</StatusChip>
        ) : (
          <StatusChip tone="noshow" testId="rec-diff">
            {differences.length === 1 ? '1 diferencia' : `${differences.length} diferencias`}
          </StatusChip>
        )}
      </div>

      {snap.rows.length === 0 ? (
        <EmptyState icon="card" title="No hay suscripciones en Stripe">
          Cuando un negocio contrate con tarjeta, aparecerá aquí con lo que factura cada mes.
        </EmptyState>
      ) : (
        <AdminTable label="Suscripciones de Stripe contra ChatVenti" minWidth={900}>
          <thead>
            <tr>
              <th scope="col" className={`${TH} ${STICKY}`}>Negocio</th>
              <th scope="col" className={TH}>Estado (Stripe · ChatVenti)</th>
              <th scope="col" className={TH}>Plan (Stripe · ChatVenti)</th>
              <th scope="col" className={`${TH} ${NUM}`}>Al mes</th>
              <th scope="col" className={TH}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {snap.rows.map((r) => (
              <tr key={r.subscriptionId} className={TR} data-testid="rec-row">
                <th scope="row" className={`${TD} ${STICKY} max-w-[15rem] text-left font-normal`}>
                  <p className="truncate font-semibold">{r.orgName}</p>
                  <p className="truncate font-mono text-[12px] text-ink-muted">{r.subscriptionId}</p>
                </th>
                <td className={`${TD} whitespace-nowrap`}>
                  {status(r.stripeStatus)} · <span className="text-ink-muted">{status(r.appStatus)}</span>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.stripePlan ?? '—'} · <span className="text-ink-muted">{r.appPlan ?? '—'}</span>
                </td>
                <td className={`${TD} ${NUM} font-semibold`}>
                  {r.monthly > 0 ? (
                    <>
                      {fmtMoney(r.monthly)} <span className="text-[12px] font-semibold text-ink-muted">{r.currency.toUpperCase()}</span>
                    </>
                  ) : (
                    <span className="font-normal text-ink-faint">—</span>
                  )}
                </td>
                <td className={TD}>
                  {r.issues.length === 0 ? (
                    <StatusChip tone="ok">Cuadra</StatusChip>
                  ) : (
                    <ul className="space-y-1 text-[13.5px] text-[#a51b18]">
                      {r.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </Page>
  )
}
