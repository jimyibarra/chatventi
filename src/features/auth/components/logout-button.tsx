'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  async function onLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      onClick={onLogout}
      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-line-soft"
    >
      Salir
    </button>
  )
}
