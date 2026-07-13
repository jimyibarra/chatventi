import type { Metadata } from 'next'
import { getAdminOrganizations, orgMonthlyUsd } from '@/features/admin/service'
import { aiTierById } from '@/features/billing/plans'
import { OrgStatusBadge } from '@/features/admin/components/org-status-badge'

export const metadata: Metadata = { title: 'Super Admin · Organizaciones' }
export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('es-MX')
const usd = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const df = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string | null): string {
  return iso ? df.format(new Date(iso)) : '—'
}

export default async function AdminOrganizationsPage() {
  const orgs = await getAdminOrganizations()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Organizaciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          {nf.format(orgs.length)} cuenta(s) registrada(s) en la plataforma.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Dueño</th>
              <th className="px-4 py-3 font-medium">Suscripción</th>
              <th className="px-4 py-3 text-right font-medium">USD/mes</th>
              <th className="px-4 py-3 text-right font-medium">Usuarios</th>
              <th className="px-4 py-3 text-right font-medium">Clientes</th>
              <th className="px-4 py-3 text-right font-medium">Citas</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3 font-medium">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{o.name}</p>
                  <p className="text-xs text-slate-400">
                    {[o.city, o.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-200">{o.owner_name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{o.owner_email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <OrgStatusBadge status={o.sub_status} />
                  <p className="mt-1 text-xs text-slate-400">
                    {o.ai_tier === 'none' ? 'Solo agenda' : `IA ${aiTierById(o.ai_tier).label.replace(/^Sí · /, '')}`}
                    {o.has_domain && ' · dominio'}
                    {o.team_seats > 0 && ` · ${o.team_seats} extra`}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-white">
                  {o.sub_status === 'active' ? usd.format(orgMonthlyUsd(o)) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{nf.format(o.users_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{nf.format(o.clients_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{nf.format(o.appointments_count)}</td>
                <td className="px-4 py-3 text-slate-400">{fmtDate(o.created_at)}</td>
                <td className="px-4 py-3 text-slate-400">{fmtDate(o.last_activity)}</td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  Aún no hay organizaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
