import { createClient } from '@/lib/supabase/server'
import { ServiceManager } from '@/features/agenda/components/config/service-manager'
import { HoursManager } from '@/features/agenda/components/config/hours-manager'
import { StaffAvailability } from '@/features/agenda/components/config/staff-availability'
import {
  getBranches,
  getServices,
  getStaff,
  getBusinessHours,
  getStaffSchedules,
} from '@/features/agenda/services'

export const dynamic = 'force-dynamic'

export default async function AgendaConfigPage() {
  const supabase = await createClient()
  const branches = await getBranches(supabase)

  if (branches.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Aún no tienes una sucursal.
        </div>
      </div>
    )
  }

  const branch = branches[0]
  const [services, staff, hours, schedules] = await Promise.all([
    getServices(supabase),
    getStaff(supabase),
    getBusinessHours(supabase, branch.id),
    getStaffSchedules(supabase, branch.id),
  ])

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configuración de la agenda</h1>
          <p className="text-sm text-gray-500">
            Sucursal: {branch.name} · Zona horaria: {branch.timezone}
          </p>
        </div>

        <ServiceManager services={services} />
        <HoursManager branchId={branch.id} hours={hours} />
        <StaffAvailability branchId={branch.id} staff={staff} schedules={schedules} />
      </div>
    </>
  )
}
