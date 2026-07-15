import { createClient } from '@/lib/supabase/server'
import { ResourceManager } from '@/features/profesionales/components/resource-manager'
import { getResources, getResourceLabel } from '@/features/profesionales/services'
import { getBranches, getServices } from '@/features/agenda/services'

export const dynamic = 'force-dynamic'

export default async function ProfesionalesPage() {
  const supabase = await createClient()
  const branches = await getBranches(supabase)

  if (branches.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-card border border-warn-bg bg-warn-bg p-6 text-sm text-warn">
          Aún no tienes una sucursal.
        </div>
      </div>
    )
  }

  const branch = branches[0]
  const [resources, services, label] = await Promise.all([
    getResources(supabase),
    getServices(supabase, { onlyActive: true }),
    getResourceLabel(supabase),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-ink">{label}</h1>
        <p className="text-sm text-ink-soft">
          Sucursal: {branch.name} · El horario de cada uno se cruza con el de la sucursal.
        </p>
      </div>

      <ResourceManager
        resources={resources}
        services={services}
        branchId={branch.id}
        label={label}
      />
    </div>
  )
}
