import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgendaBoard } from '@/features/agenda/components/agenda-board'
import {
  getBranches,
  getServices,
  getStaff,
  getAppointmentsRange,
} from '@/features/agenda/services'
import { dayRangeUtc, weekRangeUtc, ymdInTz } from '@/features/agenda/datetime'

export const dynamic = 'force-dynamic'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; view?: string; date?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const branches = await getBranches(supabase)
  if (branches.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Aún no tienes una sucursal. Se crea automáticamente al registrar tu negocio.
        </div>
      </div>
    )
  }

  const branch = branches.find((b) => b.id === sp.branch) ?? branches[0]
  const tz = branch.timezone
  const view = sp.view === 'week' ? 'week' : 'day'
  const date = sp.date ?? ymdInTz(new Date(), tz)

  const week = weekRangeUtc(date, tz)
  const range = view === 'week' ? { from: week.from, to: week.to } : dayRangeUtc(date, tz)

  const [appointments, services, staff] = await Promise.all([
    getAppointmentsRange(supabase, branch.id, range.from, range.to),
    getServices(supabase, { onlyActive: true }),
    getStaff(supabase),
  ])

  return (
    <>
      <nav className="flex gap-4 border-b border-gray-200 bg-white px-6 py-2 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
          Panel
        </Link>
        <Link href="/dashboard/agenda" className="font-medium text-gray-900">
          Agenda
        </Link>
      </nav>
      <AgendaBoard
        branchId={branch.id}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        tz={tz}
        view={view}
        date={date}
        weekDays={week.days}
        appointments={appointments}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
        }))}
        staff={staff.map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </>
  )
}
