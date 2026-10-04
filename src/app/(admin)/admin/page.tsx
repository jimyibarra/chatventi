import type { Metadata } from 'next'
import {
  computeMrr,
  getAdminGlobalStats,
  getAdminOrganizations,
  getBillingInquiries,
  getOrgBilling,
  getPartnerOrigins,
  internalOrgIds,
  paysChatVenti,
} from '@/features/admin/service'
import { BillingInquiriesPanel } from '@/features/admin/components/billing-inquiries-panel'
import { OrgStatusBadge } from '@/features/admin/components/org-status-badge'
import { AdminTable, NUM, STICKY, TD, TH, TR } from '@/features/admin/components/admin-table'
import { ButtonLink, EmptyState, Icon, KpiCell, Notice, Page, PageHeader } from '@/shared/components/ui'
import { fmtInt, fmtMoney } from '@/shared/lib/format'

export const metadata: Metadata = { title: 'Super Admin · Resumen' }
// Datos siempre frescos: es un panel de monitoreo en vivo.
export const dynamic = 'force-dynamic'

function plural(n: number, one: string, many: string): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`
}

function GroupTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2.5 text-[1.15rem] font-bold leading-tight text-ink">
      {children}
    </h2>
  )
}

export default async function AdminOverviewPage() {
  const [stats, orgs, origins, billing, inquiries] = await Promise.all([
    getAdminGlobalStats(),
    getAdminOrganizations(),
    getPartnerOrigins(),
    getOrgBilling(),
    getBillingInquiries(),
  ])
  const internal = internalOrgIds(origins)
  const mrr = computeMrr(orgs, billing, origins)
  const includedActive = orgs.filter((o) => o.sub_status === 'active' && internal.has(o.id)).length
  const paying = orgs.filter((o) => o.sub_status === 'active' && paysChatVenti(billing.get(o.id), origins.get(o.id))).length
  const recent = orgs.slice(0, 8)
  const pastDue = stats.subs_past_due

  return (
    <Page width="wide">
      <PageHeader title="Resumen de la plataforma" subtitle="Todas las cuentas de ChatVenti, en vivo." />

      {/* Lo único que pide algo: cobros que fallaron. */}
      {pastDue > 0 && (
        <Notice
          tone="action"
          className="mb-5"
          title={`${plural(pastDue, 'suscripción tiene', 'suscripciones tienen')} el pago pendiente`}
          action={
            <ButtonLink href="/admin/organizaciones" variant="secondary" size="sm">
              Ver organizaciones
            </ButtonLink>
          }
        >
          Stripe no pudo cobrarlas. Siguen funcionando 7 días mientras Stripe reintenta; después se pausan hasta que paguen.
        </Notice>
      )}

      <BillingInquiriesPanel rows={inquiries} />

      <section aria-labelledby="kpi-subs" className="mb-6">
        <GroupTitle id="kpi-subs">Suscripciones</GroupTitle>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCell
            label="Ingreso mensual en pesos"
            value={fmtMoney(mrr.mxn)}
            unit="MXN"
            hint="Sin IVA; el anual repartido en 12 meses"
            testId="mrr-mxn"
          />
          <KpiCell
            label="Ingreso mensual en dólares"
            value={fmtMoney(mrr.usd)}
            unit="USD"
            hint={`${plural(paying, 'negocio que paga', 'negocios que pagan')}${
              includedActive > 0 ? ` · ${fmtInt(includedActive)} en paquetes de otra plataforma` : ''
            }`}
            testId="mrr-usd"
          />
          <KpiCell
            label="En prueba gratis"
            value={fmtInt(stats.subs_trialing)}
            hint={`Aún sin cobrar · ${plural(stats.subs_canceled, 'cancelada', 'canceladas')}`}
          />
          <KpiCell
            label="Pago pendiente"
            value={fmtInt(pastDue)}
            hint={pastDue > 0 ? 'En sus 7 días de gracia o ya pausadas' : 'Ningún cobro fallido'}
            tone={pastDue > 0 ? 'danger' : 'plain'}
          />
        </dl>
      </section>

      <section aria-labelledby="kpi-uso" className="mb-7">
        <GroupTitle id="kpi-uso">Uso de la plataforma</GroupTitle>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCell label="Organizaciones" value={fmtInt(stats.orgs_total)} hint={`+${fmtInt(stats.new_orgs_30d)} en 30 días`} />
          <KpiCell label="Usuarios" value={fmtInt(stats.users_total)} />
          <KpiCell
            label="Conversaciones"
            value={fmtInt(stats.conversations_total)}
            hint={`${fmtInt(stats.msgs_7d)} mensajes en 7 días`}
          />
          <KpiCell label="Citas" value={fmtInt(stats.appointments_total)} hint={`${fmtInt(stats.appts_7d)} nuevas en 7 días`} />
        </dl>
      </section>

      <section aria-labelledby="recientes">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <GroupTitle id="recientes">Organizaciones recientes</GroupTitle>
          <ButtonLink href="/admin/organizaciones" variant="ghost" size="sm" className="-mr-2 mb-2.5">
            Ver todas
            <Icon name="arrowRight" className="h-4 w-4" />
          </ButtonLink>
        </div>

        {recent.length === 0 ? (
          <EmptyState icon="building" title="Aún no hay organizaciones registradas">
            Cuando alguien confirme su correo y cree su negocio, aparecerá aquí con su plan y su actividad.
          </EmptyState>
        ) : (
          <AdminTable label="Organizaciones recientes" minWidth={680}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} ${STICKY}`}>
                  Negocio
                </th>
                <th scope="col" className={TH}>
                  Dueño
                </th>
                <th scope="col" className={TH}>
                  Suscripción
                </th>
                <th scope="col" className={`${TH} ${NUM}`}>
                  Citas
                </th>
                <th scope="col" className={`${TH} ${NUM}`}>
                  Chats
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className={TR}>
                  <th scope="row" className={`${TD} ${STICKY} max-w-[15rem] text-left font-normal`}>
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="truncate text-[13px] text-ink-muted">
                      {[o.city, o.country].filter(Boolean).join(', ') || 'Sin ciudad'}
                    </p>
                  </th>
                  <td className={`${TD} text-ink-muted`}>{o.owner_email ?? '—'}</td>
                  <td className={TD}>
                    <OrgStatusBadge status={o.sub_status} includedIn={internal.has(o.id) ? origins.get(o.id)?.name : undefined} />
                  </td>
                  <td className={`${TD} ${NUM}`}>{fmtInt(o.appointments_count)}</td>
                  <td className={`${TD} ${NUM}`}>{fmtInt(o.conversations_count)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </section>
    </Page>
  )
}
