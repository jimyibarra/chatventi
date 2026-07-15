import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Proxy (antes "middleware"): refresca la sesion de Supabase en cada request y
 * protege rutas. Next.js 16 renombro la convencion middleware.ts -> proxy.ts.
 * Patron portado de SastrePro2 (src/proxy.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: getUser() revalida el token con Supabase (no confiar en getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isProtected = pathname.startsWith('/dashboard')
  const isBilling = pathname.startsWith('/dashboard/facturacion')

  // Secciones acotadas por rol. Vive AQUI y no en los layouts: el proxy corre
  // en CADA navegación; los layouts no se re-renderizan en soft-nav y dejarían
  // el gate abierto (aprendizaje del commit 5e2ce80).
  const ROLE_GATES: { prefix: string; allow: string[] }[] = [
    { prefix: '/dashboard/facturacion', allow: ['owner'] },
    { prefix: '/dashboard/conexiones', allow: ['owner'] },
    { prefix: '/dashboard/equipo', allow: ['owner'] },
    { prefix: '/dashboard/profesionales', allow: ['owner', 'manager'] },
  ]

  // Sin sesion + ruta protegida -> login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesion + en login/signup -> dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && isProtected) {
    // .eq('id') NO es opcional: la policy `profile_select` deja ver TODOS los
    // perfiles de la org, así que sin el filtro maybeSingle() recibe N filas,
    // devuelve error, role queda null y los gates de abajo se saltan EN
    // SILENCIO en cuanto la org tiene más de un miembro. Mismo patrón que
    // (main)/layout.tsx.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = profile?.role ?? null

    // Sin profile aún = acaba de confirmar el correo y no ha hecho onboarding.
    // El super_admin no es un tenant: el layout lo manda a /admin.
    if (role && role !== 'super_admin') {
      // ¿La org tiene acceso (prueba vigente o suscripción activa)?
      const { data: org } = await supabase
        .from('organizations')
        .select('trial_ends_at')
        .maybeSingle()

      let hasAccess = true
      if (org) {
        const { data: sub } = await supabase.from('subscriptions').select('status').maybeSingle()
        const subActive = !!sub && (sub.status === 'trialing' || sub.status === 'active')
        const trialOk = !!org.trial_ends_at && new Date(org.trial_ends_at) > new Date()
        hasAccess = subActive || trialOk
      }

      // Gate de acceso: prueba vencida sin suscripción → a Facturación (única
      // ruta permitida) para poder pagar.
      if (!hasAccess && !isBilling) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/facturacion'
        url.searchParams.set('bloqueado', '1')
        return NextResponse.redirect(url)
      }

      // Gate de rol: SOLO cuando la org tiene acceso. Si no lo tiene, el gate
      // de arriba manda a todos a Facturación; bloquear ahí a un no-dueño
      // provocaría un bucle infinito de redirecciones (facturación → dashboard
      // → facturación). Sin acceso, el no-dueño ve la pantalla de bloqueo y
      // entiende por qué no puede entrar.
      if (hasAccess) {
        const gate = ROLE_GATES.find((g) => pathname.startsWith(g.prefix))
        if (gate && !gate.allow.includes(role)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          url.search = ''
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return response
}

export const config = {
  // Excluye estaticos y assets; corre en el resto para refrescar sesion.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
