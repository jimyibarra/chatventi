'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ---------------------------------------------------------------------
// Navegación del panel, diseño «Líneas» (única fuente de navegación):
//   · Computadora (≥md): riel violeta fijo a la izquierda.
//   · Celular (<md):     barra violeta fija abajo.
//   En ambos: Panel · Agenda · Chats · Clientes · Más. Cada sección tiene su
//   propio color de ficha; la activa se pinta en blanco. «Más» abre el resto.
// ---------------------------------------------------------------------

// `roles`: quién ve el item. Ausente = todos. Esto es COSMÉTICO (no enseñar lo
// que no puedes usar); el bloqueo real vive en el proxy y en las RPCs.
type NavItem = { href: string; label: string; icon: keyof typeof ICONS; tile?: string; roles?: string[] }

const ICONS = {
  home: 'M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  calendar: 'M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  chat: 'M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5V17h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z',
  users: 'M12.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM2.5 20a6.5 6.5 0 0 1 13 0M16 5.3a3.5 3.5 0 0 1 0 6.4M18.5 14.6a6.5 6.5 0 0 1 3 5.4',
  robot: 'M8 8h8a3.5 3.5 0 0 1 3.5 3.5v4A3.5 3.5 0 0 1 16 19H8a3.5 3.5 0 0 1-3.5-3.5v-4A3.5 3.5 0 0 1 8 8zM12 8V4.5M9.5 12.5v2M14.5 12.5v2',
  globe: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM3.5 12h17M12 3.5c3.2 3.4 3.2 13.6 0 17M12 3.5c-3.2 3.4-3.2 13.6 0 17',
  plug: 'M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7ZM12 16v5',
  card: 'M3 7h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM3 10h18M7 14h4',
  badge: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5.5 21v-1.5A4.5 4.5 0 0 1 10 15h4a4.5 4.5 0 0 1 4.5 4.5V21',
  team: 'M17 20h5v-1a3 3 0 0 0-3-3h-1M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1M16.5 5.5a3 3 0 0 1 0 5.6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
} as const

function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'dots' ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Panel', icon: 'home', tile: '#f2600c' },
  { href: '/dashboard/agenda', label: 'Agenda', icon: 'calendar', tile: '#2a1a5e' },
  { href: '/dashboard/conversaciones', label: 'Chats', icon: 'chat', tile: '#008891' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'users', tile: '#a87700' },
]

const SECONDARY: NavItem[] = [
  { href: '/dashboard/profesionales', label: 'Profesionales', icon: 'badge', roles: ['owner', 'manager'] },
  { href: '/dashboard/equipo', label: 'Equipo', icon: 'team', roles: ['owner'] },
  { href: '/dashboard/agente', label: 'Recepcionista IA', icon: 'robot' },
  { href: '/dashboard/reservas-web', label: 'Reservas Web', icon: 'globe' },
  { href: '/dashboard/conexiones', label: 'Conexiones', icon: 'plug', roles: ['owner'] },
  { href: '/dashboard/facturacion', label: 'Facturación', icon: 'card', roles: ['owner'] },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

const ITEM =
  'group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 pb-1.5 pt-1.5 text-[12px] font-semibold leading-tight transition-colors md:flex-none md:py-2'

function Tile({ item, active, count }: { item: Pick<NavItem, 'icon' | 'tile'>; active: boolean; count?: number }) {
  return (
    <span
      className="relative grid h-10 w-10 place-items-center rounded-[13px] text-white transition-transform group-active:scale-90"
      style={{ background: item.tile ?? '#3a2fa8' }}
    >
      <Icon name={item.icon} />
      {!!count && (
        <b
          className={`absolute -right-2 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ffcd2e] px-1 text-[12px] font-bold leading-none text-ink ${
            active ? 'shadow-[0_0_0_2px_#fff]' : 'shadow-[0_0_0_2px_rgb(var(--brand-500))]'
          }`}
        >
          {count > 9 ? '9+' : count}
        </b>
      )}
    </span>
  )
}

export function DashboardNav({ role, badges, brandName = 'ChatVenti', iconUrl = '/brand/chatventi-icon.png' }: { role: string; badges?: { agenda: number; chats: number }; brandName?: string; iconUrl?: string }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const secondary = SECONDARY.filter((i) => !i.roles || i.roles.includes(role))
  const moreActive = secondary.some((i) => isActive(pathname, i.href))
  const counts: Record<string, number | undefined> = {
    '/dashboard/agenda': badges?.agenda,
    '/dashboard/conversaciones': badges?.chats,
  }

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around gap-0.5 bg-brand-500 px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 md:inset-y-0 md:left-0 md:right-auto md:w-[84px] md:flex-col md:justify-start md:gap-1.5 md:overflow-y-auto md:px-1.5 md:py-3"
        aria-label="Navegación principal"
      >
        <Link href="/dashboard" className="mb-2 hidden justify-center md:flex" aria-label={`${brandName}, ir al Panel`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl} alt="" className="h-12 w-12 rounded-[14px] bg-white p-1.5" />
        </Link>
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`${ITEM} ${active ? 'bg-white text-ink' : 'text-white hover:bg-white/15'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Tile item={item} active={active} count={counts[item.href]} />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`${ITEM} ${moreActive || moreOpen ? 'bg-white text-ink' : 'text-white hover:bg-white/15'}`}
          aria-expanded={moreOpen}
          aria-controls="nav-mas"
        >
          <Tile item={{ icon: 'dots' }} active={moreActive || moreOpen} />
          Más
        </button>
      </nav>

      {/* «Más»: hoja inferior en celular, panel junto al riel en computadora. */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-ink/40" onClick={() => setMoreOpen(false)}>
          <div
            id="nav-mas"
            className="absolute inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] rounded-t-[22px] bg-white p-3 pb-4 shadow-xl md:inset-x-auto md:bottom-auto md:left-[96px] md:top-[300px] md:w-[270px] md:rounded-[20px] md:pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            {secondary.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex min-h-[48px] items-center gap-3 rounded-[13px] px-3 text-[15px] font-semibold transition-colors ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-surface'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-500 text-white">
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
