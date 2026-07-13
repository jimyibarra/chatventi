import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/features/auth/components/logout-button'

// Área de Super Admin ("god mode"): separada del dashboard de cliente.
// Doble guarda: aquí (rol) + las RPC admin_* validan super_admin en la BD.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // Solo super_admin. Cualquier otro rol se va a su panel normal.
  if (profile?.role !== 'super_admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/chatventi-icon.png" alt="" className="h-7 w-7 rounded-md" />
            <span className="text-sm font-extrabold tracking-tight">
              ChatVenti <span className="text-slate-400">· Super Admin</span>
            </span>
          </Link>
          <nav className="ml-4 flex items-center gap-1 text-sm">
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Resumen
            </Link>
            <Link
              href="/admin/organizaciones"
              className="rounded-lg px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Organizaciones
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}
