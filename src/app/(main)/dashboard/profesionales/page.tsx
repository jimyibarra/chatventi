import { createClient } from '@/lib/supabase/server'
import { ResourceManager } from '@/features/profesionales/components/resource-manager'
import { getResources, getResourceLabel } from '@/features/profesionales/services'
import { getBranches, getServices } from '@/features/agenda/services'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { EmptyState } from '@/shared/components/ui/empty-state'

export const dynamic = 'force-dynamic'

export default async function ProfesionalesPage() {
  const supabase = await createClient()
  const branches = await getBranches(supabase)

  if (branches.length === 0) {
    return (
      <Page width="narrow">
        <EmptyState icon="badge" title="Aún no tienes una sucursal">
          Se crea automáticamente al registrar tu negocio.
        </EmptyState>
      </Page>
    )
  }

  const branch = branches[0]
  const [resources, services, label, { data: orgId }] = await Promise.all([
    getResources(supabase),
    getServices(supabase, { onlyActive: true }),
    getResourceLabel(supabase),
    supabase.rpc('get_my_org'),
  ])

  return (
    <Page>
      <PageHeader
        title={label}
        subtitle={`Quién presta tus servicios en ${branch.name}. Cada uno es una línea de color en tu agenda; su horario se cruza con el de la sucursal.`}
      />

      <ResourceManager
        orgId={orgId ?? ''}
        resources={resources}
        services={services}
        branchId={branch.id}
        label={label}
      />
    </Page>
  )
}
