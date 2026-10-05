'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/shared/components/ui/icon'

// Secciones del super admin. Va en la barra de tinta de arriba: en computadora
// junto al logo; en celular, en su propia fila que se desliza de lado.
const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Resumen', icon: 'home' },
  { href: '/admin/organizaciones', label: 'Organizaciones', icon: 'building' },
  { href: '/admin/agente', label: 'Agente IA', icon: 'robot' },
  { href: '/admin/socios', label: 'Socios', icon: 'users' },
  { href: '/admin/promocion', label: 'Promoción', icon: 'megaphone' },
  { href: '/admin/conciliacion', label: 'Conciliación', icon: 'card' },
  { href: '/admin/plantillas', label: 'Plantillas', icon: 'whatsapp' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav() {
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)

  // En celular la fila no cabe entera: centra la sección actual. Solo mueve la
  // fila de lado (scrollTo sobre la lista), nunca la página.
  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !current || list.scrollWidth <= list.clientWidth) return
    list.scrollTo({ left: current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2 })
  }, [pathname])

  return (
    // min-w-0: sin él, el ítem flex mide lo que toda la fila y desborda la página en celular.
    <nav aria-label="Secciones del super admin" className="order-last -mx-4 min-w-0 basis-[calc(100%+2rem)] md:order-none md:mx-0 md:basis-auto md:flex-1">
      <ul
        ref={listRef}
        className="flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-3 text-[14.5px] font-semibold transition-colors duration-150 focus-visible:outline-white md:min-h-[40px] ${
                  active ? 'bg-white text-ink' : 'text-[#dcd8f7] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon name={item.icon} className={`h-[18px] w-[18px] ${active ? 'text-brand-500' : ''}`} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
