'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runQuickSetup } from '../quick-setup'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'

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
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[16px] bg-brand-50 p-4">
      <p className="min-w-0 flex-1 basis-[18rem] text-[14.5px] leading-snug text-brand-900">
        <b>¿Prefieres no empezar de cero?</b> Creamos por ti servicios típicos de tu giro, un horario
        de lunes a sábado, tu agenda como profesional y dejamos encendida a tu recepcionista. Todo se
        puede editar después.
      </p>
      <Button onClick={run} disabled={pending} data-testid="quick-setup">
        <Icon name="sparkle" />
        {pending ? 'Preparando…' : 'Déjamelo listo'}
      </Button>
      {msg && (
        <p className={`w-full text-sm font-semibold ${msg.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
