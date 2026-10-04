'use client'

import { useState, useTransition } from 'react'
import { createPartner, deletePartner, rotatePartnerKey, setPartnerStatus, updatePartner } from '../partner-actions'
import { Button, Card, Field, Input, Notice, SEGMENT_GROUP, Section, StatusChip, segmentItem } from '@/shared/components/ui'

type PartnerKind = 'external' | 'internal'

export type PartnerRow = {
  id: string
  name: string
  billing_email: string
  api_key_prefix: string
  discount_pct: number
  status: 'active' | 'suspended'
  organizations: number
  kind: PartnerKind
}

const DISCOUNT_HINT = 'Se resta al precio de lista de cada plan cuando le facturas al socio. 0 = sin descuento.'

// Grupo ELRI es dueño de ChatVenti, PASEN, SastrePro y ContaCero: entre ellas
// no hay factura. El socio interno cobra a su cliente; ChatVenti solo da acceso.
const KINDS: { value: PartnerKind; label: string; help: string }[] = [
  {
    value: 'internal',
    label: 'Interno · Grupo ELRI',
    help: 'Otra plataforma de Grupo ELRI, como PASEN. No se le factura nada: ella le cobra a su cliente, incluido el uso de IA adicional.',
  },
  {
    value: 'external',
    label: 'Externo · otra empresa',
    help: 'Una empresa distinta. Cada mes se le factura el plan de sus negocios, con su descuento, más el uso de IA adicional.',
  },
]

/** Clave recién generada: se muestra una sola vez, con botón de copiar. */
function KeyReveal({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Notice
      tone="action"
      action={
        <span className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard?.writeText(apiKey).then(() => setCopied(true)).catch(() => {})}
          >
            {copied ? 'Copiada' : 'Copiar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Ya la guardé
          </Button>
        </span>
      }
    >
      <span className="block font-semibold">Copia esta clave ahora: no se vuelve a mostrar.</span>
      <code className="mt-1.5 block select-all break-all rounded-[10px] bg-white/70 px-3 py-2 font-mono text-[13px]" data-testid="partner-key">
        {apiKey}
      </code>
    </Notice>
  )
}

function PartnerForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  initial: { name: string; email: string; discount: string; kind: PartnerKind }
  submitLabel: string
  onSubmit: (v: { name: string; billingEmail: string; discountPct: string; kind: PartnerKind }) => void
  onCancel?: () => void
  pending: boolean
}) {
  const [name, setName] = useState(initial.name)
  const [email, setEmail] = useState(initial.email)
  const [discount, setDiscount] = useState(initial.discount)
  const [kind, setKind] = useState<PartnerKind>(initial.kind)
  const internal = kind === 'internal'
  const valid = name.trim().length >= 2 && email.includes('@') && (internal || discount.trim() !== '')
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,13rem)]">
      <div className="space-y-1.5 sm:col-span-3">
        <div className={SEGMENT_GROUP} role="group" aria-label="Tipo de socio">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={segmentItem(kind === k.value)}
              data-testid={`partner-kind-${k.value}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="max-w-[70ch] text-[13.5px] text-ink-muted">{KINDS.find((k) => k.value === kind)?.help}</p>
      </div>
      <Field label="Nombre del socio">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="PASEN" data-testid="partner-name" />
      </Field>
      <Field
        label={internal ? 'Correo de contacto' : 'Correo de facturación'}
        hint={internal ? 'Del equipo de esa plataforma. No recibe facturas.' : 'A dónde le mandas su factura mensual.'}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={internal ? 'equipo@plataforma.com' : 'facturas@socio.com'}
          data-testid="partner-email"
        />
      </Field>
      {!internal && (
        <Field label="Descuento de mayoreo (%)" hint={DISCOUNT_HINT}>
          <Input
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="20"
            className="tabular-nums"
            data-testid="partner-discount"
          />
        </Field>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <Button
          // Al interno no se le cobra: su descuento se conserva tal cual, sin usarse.
          onClick={() => onSubmit({ name, billingEmail: email, discountPct: discount.trim() || '0', kind })}
          disabled={pending || !valid}
        >
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}

function PartnerCard({ row }: { row: PartnerRow }) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const active = row.status === 'active'

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) return setError(res.error ?? 'Algo salió mal.')
      after?.()
    })
  }

  return (
    <Card as="li" className="space-y-3.5" data-testid="partner-row">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-[14rem]">
          <p className="flex flex-wrap items-center gap-2 text-[1.05rem] font-bold text-ink">
            {row.name}
            <StatusChip tone={active ? 'ok' : 'off'}>{active ? 'Activo' : 'Suspendido'}</StatusChip>
            <StatusChip tone={row.kind === 'internal' ? 'brand' : 'neutral'}>
              {row.kind === 'internal' ? 'Interno · Grupo ELRI' : 'Externo'}
            </StatusChip>
          </p>
          <p className="text-[14px] text-ink-muted">{row.billing_email}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 text-[14px]">
          <div>
            <dt className="text-[12.5px] text-ink-muted">Clave</dt>
            <dd className="font-mono text-[13px] text-ink">{row.api_key_prefix}…</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink-muted">Descuento</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {row.kind === 'internal' ? <span className="font-normal text-ink-muted">No aplica</span> : `${Number(row.discount_pct)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink-muted">Negocios</dt>
            <dd className="font-semibold tabular-nums text-ink">{row.organizations}</dd>
          </div>
        </dl>
      </div>

      {mode === 'edit' && (
        <PartnerForm
          initial={{ name: row.name, email: row.billing_email, discount: String(Number(row.discount_pct)), kind: row.kind }}
          submitLabel="Guardar cambios"
          pending={pending}
          onCancel={() => setMode('view')}
          onSubmit={(v) => run(() => updatePartner({ id: row.id, ...v }), () => setMode('view'))}
        />
      )}

      {mode === 'delete' && (
        <Notice
          tone="danger"
          action={
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={() => run(() => deletePartner(row.id))} disabled={pending}>
                Sí, eliminar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('view')} disabled={pending}>
                Cancelar
              </Button>
            </span>
          }
        >
          ¿Eliminar a {row.name}? Su clave deja de funcionar y no se puede deshacer.
        </Notice>
      )}

      {newKey && <KeyReveal apiKey={newKey} onDone={() => setNewKey(null)} />}
      {error && <p className="text-[14px] text-[#a51b18]">{error}</p>}

      {mode === 'view' && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button size="sm" variant="secondary" onClick={() => setMode('edit')} disabled={pending}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run(() => setPartnerStatus(row.id, active ? 'suspended' : 'active'))}
            disabled={pending}
            data-testid="partner-toggle"
          >
            {active ? 'Suspender' : 'Reactivar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run(async () => {
                const res = await rotatePartnerKey(row.id)
                if (res.ok) setNewKey(res.apiKey)
                return res
              })
            }
            disabled={pending}
          >
            Generar clave nueva
          </Button>
          {row.organizations === 0 ? (
            <Button size="sm" variant="danger" onClick={() => setMode('delete')} disabled={pending} data-testid="partner-delete">
              Eliminar
            </Button>
          ) : (
            <span className="self-center text-[13px] text-ink-muted">Con negocios no se elimina: se suspende.</span>
          )}
        </div>
      )}
    </Card>
  )
}

export function PartnersPanel({ rows }: { rows: PartnerRow[] }) {
  const [pending, startTransition] = useTransition()
  const [newKey, setNewKey] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState('')

  function create(v: { name: string; billingEmail: string; discountPct: string; kind: PartnerKind }) {
    setError('')
    setNewKey(null)
    startTransition(async () => {
      const res = await createPartner(v)
      if (!res.ok) return setError(res.error)
      setNewKey(res.apiKey)
      setFormKey((k) => k + 1)
    })
  }

  return (
    <div className="space-y-4">
      <Section title="Nuevo socio" description="Al crearlo se genera su clave de acceso a la API. Pásala al servidor del socio; aquí solo queda su huella.">
        <div className="space-y-3.5">
          <PartnerForm key={formKey} initial={{ name: '', email: '', discount: '0', kind: 'external' }} submitLabel="Crear y generar clave" pending={pending} onSubmit={create} />
          {error && <p className="text-[14px] text-[#a51b18]">{error}</p>}
          {newKey && <KeyReveal apiKey={newKey} onDone={() => setNewKey(null)} />}
        </div>
      </Section>

      {rows.length === 0 ? (
        <Card>
          <p className="text-[15px] text-ink-muted">Todavía no hay socios. El primero que crees aparecerá aquí con su descuento y sus negocios.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <PartnerCard key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  )
}
