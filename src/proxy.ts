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

  // Gate de acceso: con la prueba vencida y sin suscripción activa, se redirige
  // a Facturación (única ruta de /dashboard permitida) para poder pagar. Corre
  // en cada navegación, así que no hay huecos por soft-nav. Solo si YA hay org
  // (si aún no existe, el usuario acaba de confirmar correo → onboarding).
  if (user && isProtected && !isBilling) {
    const { data: org } = await supabase
      .from('organizations')
      .select('trial_ends_at')
      .maybeSingle()
    if (org) {
      const { data: sub } = await supabase.from('subscriptions').select('status').maybeSingle()
      const subActive = !!sub && (sub.status === 'trialing' || sub.status === 'active')
      const trialOk = !!org.trial_ends_at && new Date(org.trial_ends_at) > new Date()
      if (!subActive && !trialOk) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/facturacion'
        url.searchParams.set('bloqueado', '1')
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  // Excluye estaticos y assets; corre en el resto para refrescar sesion.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
