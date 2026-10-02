'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runQuickSetup } from '../quick-setup'

/** "Déjamelo listo": crea lo que falte con valores típicos del giro. */
export function QuickSetupButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function run() {
    setMsg(null)
    startTransition(async () => {
      const res = await runQuickSetup()
      if (!res.ok) return setMsg({ ok: false, text: res.error })
      setMsg({
        ok: true,
        text: res.done.length ? `Listo: ${res.done.join(', ')}. Ajusta lo que quieras.` : 'Ya estaba todo creado.',
      })
      router.refresh()
    })
  }

  return (
    <div className="mb-4 rounded-[14px] bg-brand-50 p-3.5">
      <p className="text-sm text-brand-900">
        <b>¿Prefieres no empezar de cero?</b> Creamos por ti servicios típicos de tu giro, un horario
        de lunes a sábado, tu agenda como profesional y dejamos encendida a tu recepcionista. Todo se
        puede editar después.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        data-testid="quick-setup"
        className="mt-2.5 inline-flex min-h-[40px] items-center rounded-[13px] bg-brand-500 px-4 text-[15px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? 'Preparando…' : 'Déjamelo listo'}
      </button>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-success' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}
