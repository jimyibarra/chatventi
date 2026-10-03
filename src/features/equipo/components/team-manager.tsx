'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  inviteMember,
  revokeInvitation,
  resendInvitation,
  changeMemberRole,
  setMemberActive,
} from '../actions'
import {
  TEAM_ROLES,
  roleKeyOf,
  type Member,
  type Seats,
  type TeamInvitation,
  type TeamRoleKey,
} from '../types'
import { Section } from '@/shared/components/ui/card'
import { Avatar } from '@/shared/components/ui/avatar'
import { Button, ButtonLink } from '@/shared/components/ui/button'
import { Field, Input, Select } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'
import { Notice } from '@/shared/components/ui/notice'
import { StatusChip } from '@/shared/components/ui/status-chip'

type ResourceOpt = { id: string; name: string }

export function TeamManager({
  members,
  invitations,
  seats,
  resources,
  myId,
}: {
  members: Member[]
  invitations: TeamInvitation[]
  seats: Seats
  resources: ResourceOpt[]
  myId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [roleKey, setRoleKey] = useState<TeamRoleKey>('recepcion')
  const [resourceId, setResourceId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manualLink, setManualLink] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const full = seats.enforced && seats.used >= seats.allowed

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await fn()
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Ocurrió un error.')
    })
  }

  function invite() {
    setError(null)
    setNotice(null)
    setManualLink(null)
    startTransition(async () => {
      const res = await inviteMember({
        email,
        roleKey,
        resourceId: roleKey === 'profesional' && resourceId ? resourceId : null,
      })
      if (!res.ok) return setError(res.error)
      setEmail('')
      // Si el SMTP no está configurado el correo NO sale: hay que dar el enlace
      // o la invitación se queda muerta sin que el dueño se entere.
      if (res.data?.emailSent) setNotice(`Invitación enviada a ${res.data.email}.`)
      else setManualLink(res.data?.link ?? null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Invitar */}
      <Section
        title="Invitar a tu equipo"
        description="Delega la operación sin dar las llaves del negocio."
        actions={
          <StatusChip tone={full ? 'wait' : 'neutral'} testId="seat-counter" size="md">
            {seats.used} de {seats.allowed} accesos en uso
          </StatusChip>
        }
      >
        {full ? (
          <Notice
            tone="action"
            title="No te quedan accesos disponibles"
            action={
              <ButtonLink href="/dashboard/facturacion" variant="secondary" size="sm">
                Añadir accesos
              </ButtonLink>
            }
          >
            Cada acceso extra cuesta $19/mes.
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Correo">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="invite-email"
                placeholder="recepcion@minegocio.com"
              />
            </Field>
            <Field label="Rol">
              <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value as TeamRoleKey)} data-testid="invite-role">
                {(Object.keys(TEAM_ROLES) as TeamRoleKey[])
                  .filter((k) => k !== 'owner')
                  .map((k) => (
                    <option key={k} value={k}>
                      {TEAM_ROLES[k].label}
                    </option>
                  ))}
              </Select>
            </Field>
            {roleKey === 'profesional' && (
              <Field label="Su ficha" className="sm:col-span-2 lg:order-last lg:col-span-1">
                <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                  <option value="">Sin vincular</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button onClick={invite} disabled={pending || !email.trim()} data-testid="invite-submit" className="sm:col-span-2 lg:col-span-1">
              <Icon name="mail" />
              Invitar
            </Button>
          </div>
        )}

        <p className="mt-2.5 flex items-start gap-2 text-[13.5px] leading-snug text-ink-muted">
          <Icon name="info" className="mt-px h-4 w-4" />
          <span>
            <b className="font-semibold text-ink">{TEAM_ROLES[roleKey].label}:</b> {TEAM_ROLES[roleKey].description}
          </span>
        </p>

        {error && <p className="mt-3 text-sm text-[#a51b18]" role="alert">{error}</p>}
        {notice && (
          <Notice tone="success" size="sm" className="mt-3">
            {notice}
          </Notice>
        )}
        {manualLink && (
          <Notice tone="action" className="mt-3" title="La invitación se creó, pero el correo no salió">
            Copia este enlace y mándaselo tú:
            <code className="mt-2 block select-all break-all rounded-[10px] bg-white/70 p-2.5 font-mono text-[12.5px]" data-testid="invite-link">
              {manualLink}
            </code>
          </Notice>
        )}
      </Section>

      {/* Pendientes */}
      {invitations.length > 0 && (
        <Section title="Invitaciones pendientes" badge={<StatusChip tone="neutral">{invitations.length}</StatusChip>}>
          <ul className="divide-y divide-line">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-surface text-ink-muted" aria-hidden>
                  <Icon name="mail" />
                </span>
                <div className="min-w-0 flex-1 basis-[12rem]">
                  <p className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{i.email}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                    <StatusChip tone="neutral">{TEAM_ROLES[roleKeyOf(i.role, i.resource_scope)].label}</StatusChip>
                    caduca el {new Date(i.expires_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => run(() => resendInvitation(i.email, roleKeyOf(i.role, i.resource_scope)))}
                    disabled={pending}
                  >
                    <Icon name="refresh" className="h-4 w-4" />
                    Reenviar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => run(() => revokeInvitation(i.id))} disabled={pending}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Miembros */}
      <Section title="Miembros" badge={<StatusChip tone="neutral">{members.length}</StatusChip>}>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const key = roleKeyOf(m.role, m.resource_scope)
            const meta = TEAM_ROLES[key]
            const isMe = m.id === myId
            const display = m.full_name || m.email || 'Sin nombre'
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3 first:pt-0 last:pb-0">
                <Avatar name={display} className={m.is_active ? '' : 'opacity-50'} />
                <div className="min-w-0 flex-1 basis-[12rem]">
                  <p className={`flex flex-wrap items-center gap-2 text-[15px] font-semibold ${m.is_active ? 'text-ink' : 'text-ink-muted line-through'}`}>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{display}</span>
                    {isMe && <StatusChip tone="brand">Tú</StatusChip>}
                    {!m.is_active && <StatusChip tone="off">Desactivado</StatusChip>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-muted [overflow-wrap:anywhere]">
                    {m.email}
                    {m.resourceName && ` · ficha: ${m.resourceName}`}
                  </p>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {isMe ? (
                    <StatusChip tone={key === 'owner' ? 'brand' : 'neutral'} size="md">
                      {meta.label}
                    </StatusChip>
                  ) : (
                    <label>
                      <span className="sr-only">Rol de {display}</span>
                      <Select
                        value={key}
                        onChange={(e) =>
                          run(() =>
                            changeMemberRole({
                              profileId: m.id,
                              roleKey: e.target.value as TeamRoleKey,
                              resourceId: m.resourceId,
                            })
                          )
                        }
                        disabled={pending}
                        data-testid={`role-select-${m.id}`}
                        wrapperClassName="w-[11.5rem]"
                      >
                        {(Object.keys(TEAM_ROLES) as TeamRoleKey[]).map((k) => (
                          <option key={k} value={k}>
                            {TEAM_ROLES[k].label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}

                  {!isMe &&
                    (m.is_active ? (
                      <Button variant="danger" size="sm" onClick={() => run(() => setMemberActive(m.id, false))} disabled={pending}>
                        Desactivar
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => run(() => setMemberActive(m.id, true))} disabled={pending}>
                        Reactivar
                      </Button>
                    ))}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
