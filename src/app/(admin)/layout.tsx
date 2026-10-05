import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { AdminNav } from '@/features/admin/components/admin-nav'
import { buttonClass } from '@/shared/components/ui/button'

// Área de Super Admin ("god mode"): separada del dashboard de cliente.
// Doble guarda: aquí (rol) + las RPC admin_* validan super_admin en la BD.
//
// Diseño «Líneas» en claro, como el panel. La barra de arriba va en TINTA (no
// en el violeta del panel): así se sabe de un vistazo que esto es la consola
// interna y no el panel de un negocio.
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
    <div className="cv-panel min-h-screen bg-surface text-ink">
      <header className="bg-ink text-white md:sticky md:top-0 md:z-30">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-2 pt-2.5 md:flex-nowrap md:px-6 md:py-3">
          <Link href="/admin" className="flex flex-none items-center gap-2.5 rounded-[12px] focus-visible:outline-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/chatventi-icon.png" alt="" className="h-9 w-9 rounded-[11px] bg-white p-1" />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight">ChatVenti</span>
              <span className="block text-[12px] font-semibold text-[#c4bff5]">Super admin</span>
            </span>
          </Link>
          <AdminNav />
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden max-w-[14rem] truncate text-[13.5px] text-[#dcd8f7] 2xl:inline">{user.email}</span>
            <LogoutButton className={`${buttonClass('inverse', 'sm')} focus-visible:outline-white`} />
          </div>
        </div>
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  )
}
