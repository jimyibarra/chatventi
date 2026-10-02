'use client'

import { useState, useTransition } from 'react'
import { createPartner, setPartnerStatus } from '../partner-actions'

export type PartnerRow = {
  id: string
  name: string
  billing_email: string
  api_key_prefix: string
  discount_pct: number
  status: 'active' | 'suspended'
  organizations: number
}

const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100'

export function PartnersPanel({ rows }: { rows: PartnerRow[] }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [discount, setDiscount] = useState('0')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  function create() {
    setError('')
    setNewKey(null)
    startTransition(async () => {
      const res = await createPartner({ name, billingEmail: email, discountPct: discount })
      if (!res.ok) return setError(res.error)
      setNewKey(res.apiKey)
      setName('')
      setEmail('')
      setDiscount('0')
    })
  }

  function toggle(row: PartnerRow) {
    startTransition(async () => {
      const res = await setPartnerStatus(row.id, row.status === 'active' ? 'suspended' : 'active')
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-white">Nuevo socio</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <input className={INPUT} placeholder="Nombre (p. ej. PASEN)" value={name} onChange={(e) => setName(e.target.value)} data-testid="partner-name" />
          <input className={INPUT} placeholder="Correo de facturación" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="partner-email" />
          <input className={INPUT} placeholder="% descuento" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-label="Descuento de mayoreo en %" />
          <button
            onClick={create}
            disabled={pending || name.trim().length < 2 || !email.includes('@')}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Crear y generar clave
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          El descuento se aplica al precio de lista de cada plan al facturarle al socio.
        </p>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        {newKey && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4" data-testid="partner-key">
            <p className="text-sm font-semibold text-amber-200">
              Copia esta clave ahora. No se vuelve a mostrar: en la base solo queda su huella.
            </p>
            <code className="mt-2 block select-all break-all rounded bg-slate-950 px-3 py-2 text-xs text-amber-100">{newKey}</code>
          </div>
        )}
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Socio</th>
              <th className="px-4 py-3">Clave</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Negocios</th>
              <th className="px-4 py-3 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Todavía no hay socios.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.billing_email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.api_key_prefix}…</td>
                <td className="px-4 py-3 tabular-nums text-slate-200">{Number(r.discount_pct)}%</td>
                <td className="px-4 py-3 tabular-nums text-slate-200">{r.organizations}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(r)}
                    disabled={pending}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      r.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {r.status === 'active' ? 'Activo · suspender' : 'Suspendido · reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
