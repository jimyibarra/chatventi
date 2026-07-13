import type { Metadata } from 'next'
import Link from 'next/link'
import {
  computeMrrUsd,
  getAdminGlobalStats,
  getAdminOrganizations,
} from '@/features/admin/service'
import { OrgStatusBadge } from '@/features/admin/components/org-status-badge'

export const metadata: Metadata = { title: 'Super Admin · Resumen' }
// Datos siempre frescos: es un panel de monitoreo en vivo.
export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('es-MX')
const usd = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default async function AdminOverviewPage() {
  const [stats, orgs] = await Promise.all([getAdminGlobalStats(), getAdminOrganizations()])
  const mrr = computeMrrUsd(orgs)
  const recent = orgs.slice(0, 8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Resumen de la plataforma</h1>
        <p className="mt-1 text-sm text-slate-400">Monitoreo global de todas las cuentas de ChatVenti.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Organizaciones" value={nf.format(stats.orgs_total)} sub={`+${stats.new_orgs_30d} en 30 días`} />
        <Kpi label="Usuarios" value={nf.format(stats.users_total)} />
        <Kpi label="MRR activo" value={usd.format(mrr)} sub={`${stats.subs_active} suscripción(es) activa(s)`} />
        <Kpi label="En prueba" value={nf.format(stats.subs_trialing)} sub="periodo gratis" />
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Pago pendiente" value={nf.format(stats.subs_past_due)} sub="past_due / unpaid" />
        <Kpi label="Canceladas" value={nf.format(stats.subs_canceled)} />
        <Kpi label="Conversaciones" value={nf.format(stats.conversations_total)} sub={`${nf.format(stats.msgs_7d)} mensajes / 7 días`} />
        <Kpi label="Citas" value={nf.format(stats.appointments_total)} sub={`${nf.format(stats.appts_7d)} nuevas / 7 días`} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Organizaciones recientes</h2>
          <Link href="/admin/organizaciones" className="text-sm font-medium text-brand-300 hover:text-brand-200">
            Ver todas →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Dueño</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 text-right font-medium">Citas</th>
                <th className="px-4 py-3 text-right font-medium">Chats</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{o.name}</p>
                    <p className="text-xs text-slate-400">{[o.city, o.country].filter(Boolean).join(', ') || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{o.owner_email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={o.sub_status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{nf.format(o.appointments_count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{nf.format(o.conversations_count)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aún no hay organizaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
