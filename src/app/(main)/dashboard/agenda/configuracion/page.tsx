import { createClient } from '@/lib/supabase/server'
import { ServiceManager } from '@/features/agenda/components/config/service-manager'
import { HoursManager } from '@/features/agenda/components/config/hours-manager'
import { getBranches, getServices, getBusinessHours } from '@/features/agenda/services'
import { getResourceLabel } from '@/features/profesionales/services'
import { DepositSettings } from '@/features/anticipos/components/deposit-settings'
import { Page, PageHeader } from '@/shared/components/ui/page-header'
import { Section } from '@/shared/components/ui/card'
import { ButtonLink } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/ui/empty-state'
import { Icon } from '@/shared/components/ui/icon'

export const dynamic = 'force-dynamic'

export default async function AgendaConfigPage() {
  const supabase = await createClient()
  const branches = await getBranches(supabase)

  if (branches.length === 0) {
    return (
      <Page width="narrow">
        <EmptyState icon="calendar" title="Aún no tienes una sucursal">
          Se crea automáticamente al registrar tu negocio.
        </EmptyState>
      </Page>
    )
  }

  const branch = branches[0]
  const [services, hours, resourceLabel, { data: depositCfg }] = await Promise.all([
    getServices(supabase),
    getBusinessHours(supabase, branch.id),
    getResourceLabel(supabase),
    supabase
      .from('organizations')
      .select('deposit_bank_details, deposit_hold_minutes, deposit_cancel_hours')
      .eq('id', branch.organization_id)
      .maybeSingle(),
  ])

  return (
    <Page width="wide">
      <PageHeader
        back={{ href: '/dashboard/agenda', label: 'Agenda' }}
        title="Configuración de la agenda"
        subtitle={`Sucursal: ${branch.name} · Zona horaria: ${branch.timezone}`}
      />

      {/* Columna ancha: servicios, horario y anticipos (cada día cabe en una fila).
          Columna estrecha: el horario de cada profesional vive en su ficha. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <ServiceManager services={services} />
          <HoursManager branchId={branch.id} hours={hours} />
          <DepositSettings
            bankDetails={depositCfg?.deposit_bank_details ?? null}
            holdMinutes={depositCfg?.deposit_hold_minutes ?? 120}
            cancelHours={depositCfg?.deposit_cancel_hours ?? 24}
          />
        </div>

        {/* La disponibilidad dejo de configurarse por usuario: ahora es de cada
            profesional/recurso, que puede no tener cuenta. Ver /dashboard/profesionales. */}
        <Section
          title={`Horario de ${resourceLabel.toLowerCase()}`}
          description="El horario individual se configura en cada ficha, junto con los servicios que presta."
        >
          <ButtonLink href="/dashboard/profesionales" variant="secondary">
            <Icon name="badge" />
            Ir a {resourceLabel}
          </ButtonLink>
        </Section>
      </div>
    </Page>
  )
}
