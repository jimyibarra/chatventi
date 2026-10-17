'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cancelMembership, startMembership } from '../actions'
import { STATE_LABEL, membershipState } from '../logic'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Select } from '@/shared/components/ui/field'
import { StatusChip } from '@/shared/components/ui/status-chip'
import { STATE_TONE, fmtDay, type PlanOption } from '../view'
export type MembershipRow = {
  id: string
  plan_name: string
  price: number | null
  starts_on: string
  ends_on: string
  cancelled_at: string | null
  payments: { id: string; amount: number; method: string; paid_on: string }[]
}

const money = (n: number) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

/** Membresía del cliente en su ficha (fase 4): la vigente, renovar con pago y el historial. */
export function MembershipSection({ clientId, plans, memberships, today }: { clientId: string; plans: PlanOption[]; memberships: MembershipRow[]; today: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const plan = plans.find((x) => x.id === planId)
  const [amount, setAmount] = useState(plan?.price != null ? String(plan.price) : '')
  const [method, setMethod] = useState('efectivo')
  const current = memberships.find((m) => !m.cancelled_at)

  function choose(id: string) {
    setPlanId(id)
    const pl = plans.find((x) => x.id === id)
    setAmount(pl?.price != null ? String(pl.price) : '')
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setError(res.error ?? 'No se pudo guardar.')
      router.refresh()
    })
  }

  return (
    <Section title="Membresía" description="Su plan, cuándo vence y lo que ha pagado. Unos días antes de vencer le llega un aviso por WhatsApp.">
      <div className="space-y-4" data-testid="membership-section">
        {current ? (
          <CurrentCard m={current} today={today} onCancel={() => run(() => cancelMembership(current.id, clientId))} pending={pending} />
        ) : (
          <p className="text-[14.5px] text-ink-muted">Sin membresía.</p>
        )}

        {plans.length === 0 ? (
          <p className="text-[14px] text-ink-muted">
            Primero crea tus planes en{' '}
            <Link href="/dashboard/membresias" className="font-semibold text-brand-800 underline underline-offset-2">
              Membresías
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 rounded-[14px] bg-surface p-3.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label={current ? 'Renovar con' : 'Plan'}>
              <Select value={planId} onChange={(e) => choose(e.target.value)} data-testid="membership-plan">
                {plans.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.duration_days} días{x.price != null ? ` · ${money(x.price)}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pagó">
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" className="tabular-nums" />
            </Field>
            <Field label="Forma de pago">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Button
              disabled={pending || !planId}
              data-testid="membership-save"
              onClick={() => run(() => startMembership({ clientId, planId, amount: amount === '' ? null : amount, method }))}
            >
              {current ? 'Renovar' : 'Registrar'}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13.5px] text-[#a51b18]">
            {error}
          </p>
        )}

        {memberships.length > 0 && (
          <div>
            <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-muted">Historial</h3>
            <ul className="divide-y divide-line text-[14px]">
              {memberships.map((m) => {
                const st = membershipState({ starts_on: m.starts_on, ends_on: m.ends_on, cancelled: !!m.cancelled_at }, today)
                const paid = m.payments.reduce((s, p) => s + Number(p.amount), 0)
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <b className="font-semibold text-ink">{m.plan_name}</b>
                    <span className="tabular-nums text-ink-muted">
                      {fmtDay(m.starts_on)} – {fmtDay(m.ends_on)}
                    </span>
                    <StatusChip tone={STATE_TONE[st]}>{STATE_LABEL[st]}</StatusChip>
                    <span className="ml-auto tabular-nums text-ink">{paid > 0 ? `Pagó ${money(paid)}` : 'Sin pago registrado'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

function CurrentCard({ m, today, onCancel, pending }: { m: MembershipRow; today: string; onCancel: () => void; pending: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const st = membershipState({ starts_on: m.starts_on, ends_on: m.ends_on, cancelled: !!m.cancelled_at }, today)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border-2 border-line p-3.5" data-testid="membership-current">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold text-ink">{m.plan_name}</p>
        <p className="text-[13.5px] tabular-nums text-ink-muted">
          Del {fmtDay(m.starts_on)} al {fmtDay(m.ends_on)}
        </p>
      </div>
      <StatusChip tone={STATE_TONE[st]}>{STATE_LABEL[st]}</StatusChip>
      {confirm ? (
        <span className="flex gap-1.5">
          <Button size="sm" variant="danger" onClick={onCancel} disabled={pending}>
            Sí, cancelar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
            No
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={pending}>
          Cancelar membresía
        </Button>
      )}
    </div>
  )
}
