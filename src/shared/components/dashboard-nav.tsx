'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ---------------------------------------------------------------------
// Navegación unificada del dashboard (única fuente de navegación):
//   · Desktop (≥md): sidebar persistente con las 8 secciones.
//   · Móvil (<md):  bottom-nav fija con Panel · Agenda · Chats · Clientes · Más
//     ("Más" despliega las secciones secundarias).
// ---------------------------------------------------------------------

type NavItem = { href: string; label: string; icon: React.ReactNode }

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  chat: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z',
  users:
    'M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 21v-1a4 4 0 0 0-2.5-3.7M15.5 5.2a3.5 3.5 0 0 1 0 6.6',
  robot:
    'M12 3v3M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM9.5 11h.01M14.5 11h.01M9 15h6',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18',
  plug: 'M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7ZM12 16v5',
  card: 'M3 7h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM3 10h18M7 14h4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
} as const

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Panel', icon: <Icon d={ICONS.home} /> },
  { href: '/dashboard/agenda', label: 'Agenda', icon: <Icon d={ICONS.calendar} /> },
  { href: '/dashboard/conversaciones', label: 'Chats', icon: <Icon d={ICONS.chat} /> },
  { href: '/dashboard/clientes', label: 'Clientes', icon: <Icon d={ICONS.users} /> },
]

const SECONDARY: NavItem[] = [
  { href: '/dashboard/agente', label: 'Recepcionista IA', icon: <Icon d={ICONS.robot} /> },
  { href: '/dashboard/reservas-web', label: 'Reservas Web', icon: <Icon d={ICONS.globe} /> },
  { href: '/dashboard/conexiones', label: 'Conexiones', icon: <Icon d={ICONS.plug} /> },
  { href: '/dashboard/facturacion', label: 'Facturación', icon: <Icon d={ICONS.card} /> },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = SECONDARY.some((i) => isActive(pathname, i.href))

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:block">
        <nav className="sticky top-0 flex flex-col gap-1 p-3" aria-label="Navegación principal">
          {[...PRIMARY, ...SECONDARY].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                isActive(pathname, item.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Bottom-nav móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white md:hidden"
        aria-label="Navegación principal"
      >
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMoreOpen(false)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive(pathname, item.href) ? 'text-brand-600' : 'text-gray-500'
            }`}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            moreActive || moreOpen ? 'text-brand-600' : 'text-gray-500'
          }`}
          aria-expanded={moreOpen}
        >
          <Icon d={ICONS.dots} />
          Más
        </button>
      </nav>

      {/* Panel "Más" (móvil) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-12 rounded-t-2xl border-t border-gray-200 bg-white p-3 pb-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {SECONDARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                  isActive(pathname, item.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
