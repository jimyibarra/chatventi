import type { Metadata } from 'next'
import { getAdminOrganizations, orgMonthlyUsd } from '@/features/admin/service'
import { planById, planFromLegacyTier } from '@/features/billing/plans'
import { OrgStatusBadge } from '@/features/admin/components/org-status-badge'
import { AdminTable, NUM, STICKY, TD, TH, TR } from '@/features/admin/components/admin-table'
import { EmptyState, Page, PageHeader } from '@/shared/components/ui'
import { fmtInt, fmtMoney, fmtShortDate, timeAgo } from '@/shared/lib/format'

export const metadata: Metadata = { title: 'Super Admin · Organizaciones' }
export const dynamic = 'force-dynamic'

export default async function AdminOrganizationsPage() {
  const orgs = await getAdminOrganizations()

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
                USD al mes
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
            {orgs.map((o) => (
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
                  <OrgStatusBadge status={o.sub_status} />
                  <p className="mt-1 whitespace-nowrap text-[13px] text-ink-muted">
                    {`Plan ${planById(planFromLegacyTier(o.ai_tier)).name}`}
                    {o.has_domain && ' · dominio'}
                    {o.team_seats > 0 && ` · ${fmtInt(o.team_seats)} extra`}
                  </p>
                </td>
                <td className={`${TD} ${NUM} font-semibold`}>
                  {o.sub_status === 'active' ? fmtMoney(orgMonthlyUsd(o)) : <span className="font-normal text-ink-faint">—</span>}
                </td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.users_count)}</td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.clients_count)}</td>
                <td className={`${TD} ${NUM}`}>{fmtInt(o.appointments_count)}</td>
                <td className={`${TD} whitespace-nowrap text-ink-muted`}>{fmtShortDate(o.created_at)}</td>
                <td className={`${TD} whitespace-nowrap text-ink-muted`}>{o.last_activity ? timeAgo(o.last_activity) : 'Sin actividad'}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
    </Page>
  )
}
