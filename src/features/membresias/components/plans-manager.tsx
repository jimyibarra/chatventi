'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPlan, archivePlan } from '../actions'
import type { PlanOption } from '../view'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input } from '@/shared/components/ui/field'

const money = (n: number) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

/** Planes de membresía del negocio (fase 4). Solo dueño o gerente los editan. */
export function PlansManager({ plans, canEdit }: { plans: PlanOption[]; canEdit: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', days: '30', price: '' })

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setError(res.error ?? 'No se pudo guardar.')
      after?.()
      router.refresh()
    })
  }

  return (
    <Section title="Planes" description="Lo que vendes: mensualidad, trimestre, paquete de clases. La membresía de cada cliente se registra desde su ficha.">
      <div className="space-y-3" data-testid="plans-manager">
        {plans.length === 0 ? (
          <p className="text-[14.5px] text-ink-muted">Todavía no tienes planes.</p>
        ) : (
          <ul className="divide-y divide-line text-[15px]">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <b className="font-semibold text-ink">{p.name}</b>
                <span className="tabular-nums text-ink-muted">
                  {p.duration_days} días{p.price != null ? ` · ${money(p.price)}` : ''}
                </span>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="ml-auto" disabled={pending} onClick={() => run(() => archivePlan(p.id))}>
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="grid gap-3 rounded-[14px] bg-surface p-3.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto] sm:items-end">
            <Field label="Nombre">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mensualidad" data-testid="plan-name" />
            </Field>
            <Field label="Duración (días)">
              <Input type="number" min={1} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="tabular-nums" />
            </Field>
            <Field label="Precio">
              <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="$" className="tabular-nums" />
            </Field>
            <Button
              disabled={pending || !form.name.trim()}
              data-testid="plan-save"
              onClick={() =>
                run(
                  () => addPlan({ name: form.name, durationDays: form.days, price: form.price === '' ? null : form.price }),
                  () => setForm({ name: '', days: '30', price: '' })
                )
              }
            >
              Agregar plan
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13.5px] text-[#a51b18]">
            {error}
          </p>
        )}
      </div>
    </Section>
  )
}
