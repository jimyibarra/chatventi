'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    <div className="mb-6 space-y-5">
      <div className="rounded-card border border-success-bg bg-success-bg p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success text-white">
            ✓
          </span>
          <div>
            <h2 className="text-lg font-bold text-success">¡Listo! Tu plan quedó activo</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Empezaste tu prueba gratis. No se te cobrará hasta que termine el periodo, y puedes
              cancelar cuando quieras desde “Administrar suscripción”.
              {!active && ' Estamos activando tu plan; si no aparece abajo en unos segundos, actualiza la página.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          ¿Qué sigue?
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-xl border border-line bg-white p-4 transition-all hover:border-brand-200 hover:shadow-card-hover"
            >
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                {s.title}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{s.body}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
