import { createClient } from '@/lib/supabase/server'
import { AgendaBoard } from '@/features/agenda/components/agenda-board'
import { getBranches, getServices, getAppointmentsRange } from '@/features/agenda/services'
import { getResources, getResourceLabel } from '@/features/profesionales/services'
import { dayRangeUtc, weekRangeUtc, ymdInTz } from '@/features/agenda/datetime'
import { buildDay } from '@/features/lineas/model'

export const dynamic = 'force-dynamic'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; view?: string; date?: string; new?: string; resource?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const branches = await getBranches(supabase)
  if (branches.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-card border border-warn-bg bg-warn-bg p-6 text-sm text-warn">
          Aún no tienes una sucursal. Se crea automáticamente al registrar tu negocio.
        </div>
      </div>
    )
  }

  const branch = branches.find((b) => b.id === sp.branch) ?? branches[0]
  const tz = branch.timezone
  const view = sp.view === 'week' ? 'week' : 'day'
  // Fecha de la URL: solo YYYY-MM-DD; cualquier otra cosa cae a hoy.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? (sp.date as string) : ymdInTz(new Date(), tz)

  const week = weekRangeUtc(date, tz)
  const range = view === 'week' ? { from: week.from, to: week.to } : dayRangeUtc(date, tz)

  const [appointments, services, resources, resourceLabel, hoursCount, schedulesCount] =
    await Promise.all([
      getAppointmentsRange(supabase, branch.id, range.from, range.to),
      getServices(supabase, { onlyActive: true }),
      getResources(supabase),
      getResourceLabel(supabase),
      supabase
        .from('business_hours')
        .select('*', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
      supabase
        .from('staff_schedules')
        .select('*', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
    ])

  const activeResources = resources.filter((r) => r.active)

  // El día se arma AQUÍ, en el servidor: si lo calculara el navegador, "ahora"
  // sería otro instante y el HTML del servidor no coincidiría con el suyo.
  const day = buildDay({
    appointments,
    resources: activeResources.map((r) => ({ id: r.id, name: r.name, schedules: r.schedules })),
    tz,
    date,
  })

  // Sin horario de sucursal o sin horario de profesionales, get_available_slots_v2
  // no puede ofrecer NINGÚN hueco ("Sin horarios disponibles" sin causa aparente).
  const missingSetup =
    hoursCount === 0
      ? {
          text: 'Aún no defines tu horario de atención, por eso no aparecen horarios al agendar.',
          href: '/dashboard/agenda/configuracion',
        }
      : schedulesCount === 0
        ? {
            text: `Aún no configuras el horario de tus ${resourceLabel.toLowerCase()}, por eso no aparecen horarios al agendar.`,
            href: '/dashboard/profesionales',
          }
        : null

  return (
    <>
      {missingSetup && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warn-bg bg-warn-bg p-4 text-sm text-warn"
            data-testid="agenda-setup-warning"
          >
            <p>{missingSetup.text}</p>
            <a
              href={missingSetup.href}
              className="rounded-xl bg-warn-strong px-3 py-1.5 text-sm font-medium text-white hover:bg-warn"
            >
              Configurar ahora
            </a>
          </div>
        </div>
      )}
      <AgendaBoard
        branchId={branch.id}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        tz={tz}
        view={view}
        date={date}
        weekDays={week.days}
        day={day}
        openNew={sp.new === '1'}
        newResourceId={sp.resource ?? null}
        appointments={appointments}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
        }))}
        resources={activeResources.map((r) => ({ id: r.id, name: r.name }))}
        resourceLabel={resourceLabel}
      />
    </>
  )
}
