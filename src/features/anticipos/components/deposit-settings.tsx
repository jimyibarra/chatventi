'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDepositSettings } from '../actions'

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

const FIELD =
  'w-full rounded-[12px] border border-line bg-white px-3 py-2 text-[15px] text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

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
    <section className="rounded-card bg-white p-5 shadow-[0_1px_0_#dde2f0]" data-testid="deposit-settings">
      <h2 className="text-[1.15rem] font-bold text-ink">Anticipo para apartar la cita</h2>
      <p className="mt-1 text-[15px] text-ink-muted">
        Cuando un servicio pide anticipo, tu recepcionista le da al cliente estos datos y aparta la
        cita mientras llega el comprobante. El dinero va directo a tu cuenta: ChatVenti no lo toca.
      </p>

      <label htmlFor="dep-bank" className="mt-4 block text-sm font-semibold text-ink">
        A dónde depositan
      </label>
      <textarea
        id="dep-bank"
        rows={3}
        value={bank}
        onChange={(e) => setBank(e.target.value)}
        placeholder={'Banco: BBVA\nCLABE: 012 180 0000 0000 0000\nA nombre de: Estética Lumen'}
        className={`${FIELD} mt-1.5`}
        data-testid="dep-bank"
      />
      <p className="mt-1 text-xs text-ink-muted">Sin estos datos no se pide anticipo, aunque el servicio lo tenga.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dep-hold" className="block text-sm font-semibold text-ink">
            Tiempo para mandar el comprobante
          </label>
          <select id="dep-hold" value={hold} onChange={(e) => setHold(e.target.value)} className={`${FIELD} mt-1.5`}>
            {HOLD.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">Si no llega, el horario se libera solo.</p>
        </div>
        <div>
          <label htmlFor="dep-cancel" className="block text-sm font-semibold text-ink">
            Se devuelve si el cliente cancela
          </label>
          <select id="dep-cancel" value={cancel} onChange={(e) => setCancel(e.target.value)} className={`${FIELD} mt-1.5`}>
            {CANCEL.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">Si cancela después, o no llega, el anticipo se queda contigo.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-[40px] items-center rounded-[13px] bg-brand-500 px-4 text-[15px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-red-600'}`}>{msg.text}</p>}
      </div>
    </section>
  )
}
