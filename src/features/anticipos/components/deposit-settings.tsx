'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDepositSettings } from '../actions'
import { Button, Field, Section, Select, Textarea } from '@/shared/components/ui'

const HOLD = [
  [30, '30 minutos'],
  [60, '1 hora'],
  [120, '2 horas'],
  [240, '4 horas'],
  [1440, '24 horas'],
] as const
const CANCEL = [
  [12, '12 horas antes'],
  [24, '24 horas antes'],
  [48, '48 horas antes'],
] as const

/** Cómo y a dónde paga el cliente el anticipo, y qué pasa si cancela o falta. */
export function DepositSettings({
  bankDetails,
  holdMinutes,
  cancelHours,
}: {
  bankDetails: string | null
  holdMinutes: number
  cancelHours: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bank, setBank] = useState(bankDetails ?? '')
  const [hold, setHold] = useState(String(holdMinutes))
  const [cancel, setCancel] = useState(String(cancelHours))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveDepositSettings({ bankDetails: bank, holdMinutes: hold, cancelHours: cancel })
      if (!res.ok) return setMsg({ ok: false, text: res.error })
      setMsg({ ok: true, text: 'Guardado.' })
      router.refresh()
    })
  }

  return (
    <Section
      data-testid="deposit-settings"
      title="Anticipo para apartar la cita"
      description="Cuando un servicio pide anticipo, tu recepcionista le da al cliente estos datos y aparta la cita mientras llega el comprobante. El dinero va directo a tu cuenta: nadie más lo toca."
    >
      <div className="space-y-4">
        <Field label="A dónde depositan" hint="Sin estos datos no se pide anticipo, aunque el servicio lo tenga.">
          <Textarea
            id="dep-bank"
            rows={3}
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder={'Banco: BBVA\nCLABE: 012 180 0000 0000 0000\nA nombre de: Estética Lumen'}
            data-testid="dep-bank"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tiempo para mandar el comprobante" hint="Si no llega, el horario se libera solo.">
            <Select id="dep-hold" value={hold} onChange={(e) => setHold(e.target.value)}>
              {HOLD.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Se devuelve si el cliente cancela" hint="Si cancela después, o no llega, el anticipo se queda contigo.">
            <Select id="dep-cancel" value={cancel} onChange={(e) => setCancel(e.target.value)}>
              {CANCEL.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-[#a51b18]'}`}>{msg.text}</p>}
        </div>
      </div>
    </Section>
  )
}
