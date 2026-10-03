import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ServiceManager } from '@/features/agenda/components/config/service-manager'
import { HoursManager } from '@/features/agenda/components/config/hours-manager'
import { getBranches, getServices, getBusinessHours } from '@/features/agenda/services'
import { getResourceLabel } from '@/features/profesionales/services'
import { DepositSettings } from '@/features/anticipos/components/deposit-settings'

export const dynamic = 'force-dynamic'

export default async function AgendaConfigPage() {
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
    <>
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Configuración de la agenda</h1>
          <p className="text-sm text-ink-soft">
            Sucursal: {branch.name} · Zona horaria: {branch.timezone}
          </p>
        </div>

        <ServiceManager services={services} />
        <HoursManager branchId={branch.id} hours={hours} />
        <DepositSettings
          bankDetails={depositCfg?.deposit_bank_details ?? null}
          holdMinutes={depositCfg?.deposit_hold_minutes ?? 120}
          cancelHours={depositCfg?.deposit_cancel_hours ?? 24}
        />

        {/* La disponibilidad dejo de configurarse por usuario: ahora es de cada
            profesional/recurso, que puede no tener cuenta. Ver /dashboard/profesionales. */}
        <section className="rounded-card border border-line bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-ink">Horario de {resourceLabel.toLowerCase()}</h2>
          <p className="mb-3 text-sm text-ink-soft">
            El horario individual se configura en cada ficha, junto con los servicios que presta.
          </p>
          <Link
            href="/dashboard/profesionales"
            className="inline-flex rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface"
          >
            Ir a {resourceLabel}
          </Link>
        </section>
      </div>
    </>
  )
}
