import type { Metadata } from 'next'
import { getAdminOrganizations, getOrgBilling, getPartnerOrigins, orgMonthly, orgPlanId, paysChatVenti } from '@/features/admin/service'
import { planById } from '@/features/billing/plans'
import { OrgStatusBadge } from '@/features/admin/components/org-status-badge'
import { AdminTable, NUM, STICKY, TD, TH, TR } from '@/features/admin/components/admin-table'
import { EmptyState, Page, PageHeader } from '@/shared/components/ui'
import { fmtInt, fmtMoney, fmtShortDate, timeAgo } from '@/shared/lib/format'

export const metadata: Metadata = { title: 'Super Admin · Organizaciones' }
export const dynamic = 'force-dynamic'

export default async function AdminOrganizationsPage() {
  const [orgs, origins, billing] = await Promise.all([getAdminOrganizations(), getPartnerOrigins(), getOrgBilling()])

  return (
    <Page width="wide">
      <PageHeader
        title="Organizaciones"
        subtitle={`${fmtInt(orgs.length)} ${orgs.length === 1 ? 'negocio registrado' : 'negocios registrados'} en la plataforma, del más reciente al más antiguo.`}
      />

      {orgs.length === 0 ? (
        <EmptyState icon="building" title="Aún no hay organizaciones registradas">
          Cuando alguien confirme su correo y cree su negocio, aparecerá aquí con su plan y su actividad.
        </EmptyState>
      ) : (
        <AdminTable label="Organizaciones" minWidth={980}>
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
                Al mes
              </th>
              <th scope="col" className={`${TH} ${NUM}`}>
                Usuarios
              </th>
              <th scope="col" className={`${TH} ${NUM}`}>
                Clientes
              </th>
              <th scope="col" className={`${TH} ${NUM}`}>
                Citas
              </th>
              <th scope="col" className={TH}>
                Alta
              </th>
              <th scope="col" className={TH}>
                Última actividad
              </th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => {
              const origin = origins.get(o.id)
              const includedIn = origin?.internal ? origin.name : undefined
              const bill = billing.get(o.id)
              const monthly = orgMonthly(o, bill)
              return (
              <tr key={o.id} className={TR}>
                <th scope="row" className={`${TD} ${STICKY} max-w-[15rem] text-left font-normal`}>
                  <p className="truncate font-semibold">{o.name}</p>
                  <p className="truncate text-[13px] text-ink-muted">
                    {[o.city, o.country].filter(Boolean).join(', ') || 'Sin ciudad'}
                  </p>
                </th>
                <td className={`${TD} max-w-[16rem]`}>
                  <p className="truncate">{o.owner_name ?? '—'}</p>
                  <p className="truncate text-[13px] text-ink-muted">{o.owner_email ?? '—'}</p>
                </td>
                <td className={TD}>
                  <OrgStatusBadge status={o.sub_status} includedIn={includedIn} />
                  <p className="mt-1 whitespace-nowrap text-[13px] text-ink-muted">
                    {`Plan ${planById(orgPlanId(o, bill)).name}`}
                    {bill?.billing_interval === 'year' && ' · anual'}
                    {o.has_domain && ' · dominio'}
                    {o.team_seats > 0 && ` · ${fmtInt(o.team_seats)} extra`}
                    {origin && !origin.internal && ` · vía ${origin.name}`}
                  </p>
                </td>
                <td className={`${TD} ${NUM} font-semibold`}>
                  {includedIn ? (
                    // Lo cobra la otra plataforma: no es ingreso de ChatVenti.
                    <span className="font-normal text-ink-muted">Incluido</span>
                  ) : o.sub_status === 'active' && !paysChatVenti(bill, origin) ? (
                    // Cuenta propia sin cobro (demo, «ChatVenti Ventas»).
                    <span className="font-normal text-ink-muted">Sin cobro</span>
                  ) : o.sub_status === 'active' ? (
                    <>
                      {fmtMoney(monthly.amount)}{' '}
                      <span className="text-[12px] font-semibold text-ink-muted">{monthly.currency.toUpperCase()}</span>
                    </>
                  ) : (
                    <span className="font-normal text-ink-faint">—</span>
                  )}
                </td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.users_count)}</td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.clients_count)}</td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.appointments_count)}</td>
                <td className={`${TD} whitespace-nowrap text-ink-muted`}>{fmtShortDate(o.created_at)}</td>
                <td className={`${TD} whitespace-nowrap text-ink-muted`}>{o.last_activity ? timeAgo(o.last_activity) : 'Sin actividad'}</td>
              </tr>
              )
            })}
          </tbody>
        </AdminTable>
      )}
    </Page>
  )
}
