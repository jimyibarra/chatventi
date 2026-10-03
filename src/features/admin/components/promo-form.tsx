'use client'

import { useState, useTransition } from 'react'
import { saveTrialPromo } from '../promo-actions'
import { Button, Field, Inset, Input, Notice, Section, Switch } from '@/shared/components/ui'

type Initial = { code: string; percent: number; months: number; active: boolean } | null

export function PromoForm({ initial }: { initial: Initial }) {
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState(initial?.code ?? 'BIENVENIDO30')
  const [percent, setPercent] = useState(String(initial?.percent ?? 30))
  const [months, setMonths] = useState(String(initial?.months ?? 3))
  const [active, setActive] = useState(initial?.active ?? true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const p = Number(percent)
  const m = Number(months)
  const preview = p > 0 && m > 0 ? `${p}% de descuento durante ${m} ${m === 1 ? 'mes' : 'meses'}` : '—'
  const recreates = initial && (initial.code !== code.trim().toUpperCase() || initial.percent !== p || initial.months !== m)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveTrialPromo({ code, percent, months, active })
      setMsg(res.ok ? { ok: true, text: 'Guardado en Stripe.' } : { ok: false, text: res.error })
    })
  }

  return (
    <Section
      title="Promoción de fin de prueba"
      description="El código que reciben los negocios cuando su prueba gratis está por terminar o ya terminó."
      data-testid="promo-form"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Código" hint="Letras, números o guiones. Así lo escribe el cliente en el pago.">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono tracking-wider" data-testid="promo-code" />
          </Field>
          <Field label="Descuento (%)">
            <Input inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} className="tabular-nums" data-testid="promo-percent" />
          </Field>
          <Field label="Durante (meses)" hint="Se aplica en esas mensualidades.">
            <Input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} className="tabular-nums" data-testid="promo-months" />
          </Field>
        </div>

        <label className="flex items-center gap-3">
          <Switch checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="promo-active" />
          <span className="text-[15px] font-semibold text-ink">{active ? 'Encendida' : 'Apagada'}</span>
          <span className="text-[14px] text-ink-muted">
            {active ? 'Sale en los correos y en Facturación.' : 'No se anuncia y Stripe deja de aceptarla.'}
          </span>
        </label>

        <Inset>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Así lo ve el negocio</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] text-ink">
            Usa el código
            <span className="rounded-[10px] border-2 border-dashed border-ink px-2.5 py-0.5 font-mono font-bold tracking-wider">
              {code.trim().toUpperCase() || '—'}
            </span>
            y obtén {preview}.
          </p>
        </Inset>

        {recreates && (
          <Notice tone="info" size="sm">
            Al cambiar el código, el % o los meses se crea un código nuevo en Stripe y el anterior se apaga. Quien ya lo usó conserva su descuento.
          </Notice>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending} data-testid="promo-save">
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {msg && (
            <p className={`text-[14px] ${msg.ok ? 'text-success' : 'text-[#a51b18]'}`} role="status">
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </Section>
  )
}
