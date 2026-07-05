import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMySubscription, subIsActive } from '@/features/billing/gating'
import { STATUS_LABELS } from '@/features/billing/plans'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // --- Onboarding safety-net -----------------------------------------------
  // Si el usuario confirmó su correo pero aún no tiene negocio, lo creamos aquí
  // con los datos "pendientes" guardados en el signup.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const meta = (user.user_metadata ?? {}) as {
      pending_org_name?: string
      pending_owner_name?: string
    }
    if (meta.pending_org_name) {
      await supabase.rpc('create_organization_with_owner', {
        p_org_name: meta.pending_org_name,
        p_owner_name: meta.pending_owner_name,
      })
      // Redirigimos en vez de re-consultar: evita el read-after-write lag de
      // Supabase (el SELECT inmediato tras el RPC puede pegar en una réplica
      // que aún no propagó la escritura). El siguiente request lee consistente.
      redirect('/dashboard')
    }
    // Sin perfil y sin onboarding pendiente: cuenta huérfana. Mostramos aviso
    // (NO redirigir a /login: el proxy la devolvería a /dashboard -> bucle).
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Tu cuenta aún no tiene un negocio asociado. Cierra sesión y regístrate
          de nuevo para crear tu negocio.
        </div>
      </div>
    )
  }

  // --- Datos del negocio (RLS los acota a la org del usuario) ----------------
  const { data: org } = await supabase
    .from('organizations')
    .select('name, created_at')
    .maybeSingle()

  const { count: channelsCount } = await supabase
    .from('channels')
    .select('*', { count: 'exact', head: true })

  const { count: branchesCount } = await supabase
    .from('branches')
    .select('*', { count: 'exact', head: true })

  const sub = await getMySubscription()
  const active = subIsActive(sub)

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Bienvenido{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>
      <p className="mt-1 text-gray-600">Panel de tu negocio</p>

      {!active && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            {sub ? `Tu suscripción está: ${STATUS_LABELS[sub.status] ?? sub.status}. ` : ''}
            Activa tu plan para desbloquear todo ChatVenti. 14 días de prueba gratis.
          </p>
          <a
            href="/dashboard/facturacion"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ver planes
          </a>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Negocio</p>
          <p className="mt-1 text-lg font-semibold text-gray-900" data-testid="org-name">
            {org?.name ?? '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Sucursales</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{branchesCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Canales conectados</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{channelsCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/dashboard/agenda"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Abrir agenda
        </a>
        <a
          href="/dashboard/agenda/configuracion"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Configurar servicios y horarios
        </a>
        <a
          href="/dashboard/agente"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Recepcionista IA
        </a>
        <a
          href="/dashboard/conversaciones"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Conversaciones
        </a>
        <a
          href="/dashboard/clientes"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Clientes
        </a>
        <a
          href="/dashboard/reservas-web"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reservas Web
        </a>
        <a
          href="/dashboard/facturacion"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Facturación
        </a>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        <p className="font-medium text-gray-900">Siguientes pasos</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Conectar WhatsApp por Embedded Signup</li>
          <li>Configurar tu agenda y disponibilidad</li>
          <li>Activar tu recepcionista IA</li>
        </ul>
      </div>
    </div>
  )
}
