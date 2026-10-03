'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Section } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'

// Pasos recomendados tras contratar: lo que el negocio debe hacer para poner
// en marcha lo que acaba de comprar.
const NEXT_STEPS = [
  {
    href: '/dashboard/conexiones',
    title: 'Conecta WhatsApp o Telegram',
    body: 'Enlaza tu número para que la IA empiece a atender a tus clientes.',
  },
  {
    href: '/dashboard/agente',
    title: 'Configura tu Recepcionista IA',
    body: 'Define qué responde, tus servicios y el modo de aprobación.',
  },
  {
    href: '/dashboard/agenda/configuracion',
    title: 'Ajusta tu agenda',
    body: 'Horarios, sucursal y servicios para que agende sin errores.',
  },
  {
    href: '/dashboard/reservas-web',
    title: 'Publica tu página de reservas',
    body: 'Comparte tu enlace para recibir citas también desde la web.',
  },
]

export function PostCheckoutSuccess({ active }: { active: boolean }) {
  const router = useRouter()
  const refreshed = useRef(false)

  // Tras volver de Stripe el webhook puede tardar 1-2 s en sincronizar el plan.
  // Si aún no aparece activo, refrescamos una vez para mostrarlo sin recargar.
  useEffect(() => {
    if (active || refreshed.current) return
    refreshed.current = true
    const t = setTimeout(() => router.refresh(), 2500)
    return () => clearTimeout(t)
  }, [active, router])

  return (
    <div className="mb-4 space-y-4">
      <Notice tone="success" title="¡Listo! Tu plan quedó activo">
        Empezaste tu prueba gratis. No se te cobrará hasta que termine el periodo, y puedes
        cancelar cuando quieras desde «Administrar suscripción».
        {!active && ' Estamos activando tu plan; si no aparece abajo en unos segundos, actualiza la página.'}
      </Notice>

      <Section title="¿Qué sigue?" description="Cuatro pasos para que tu recepcionista empiece a vender.">
        {/* Los pasos son estaciones de una misma línea: el orden importa. */}
        <ol className="relative">
          <i className="absolute bottom-6 left-[15px] top-6 w-1 rounded bg-brand-200" aria-hidden />
          {NEXT_STEPS.map((s, i) => (
            <li key={s.href} className="relative">
              <Link
                href={s.href}
                className="group flex items-center gap-3.5 rounded-[14px] py-2.5 pr-2 transition-colors duration-150 hover:bg-brand-50"
              >
                <span className="relative z-[1] grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-[3.5px] border-brand-500 bg-white text-[14px] font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                  <span className="block text-[13.5px] leading-snug text-ink-muted">{s.body}</span>
                </span>
                <Icon name="chevronRight" className="h-5 w-5 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}
