'use client'

import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  async function onLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Navegación DURA (no SPA): recarga completa que descarta todo el estado
    // del cliente y deja el login limpio, sin credenciales del usuario previo.
    window.location.href = '/login'
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
