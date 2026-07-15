'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
    <div className="space-y-5">
      {/* Invitar */}
      <section className="rounded-card border border-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">Invitar a tu equipo</h2>
            <p className="text-sm text-ink-soft">
              Delega la operación sin dar las llaves del negocio.
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              full ? 'border-warn-bg bg-warn-bg text-warn' : 'border-line text-ink-muted'
            }`}
            data-testid="seat-counter"
          >
            {seats.used} de {seats.allowed} accesos en uso
          </span>
        </div>

        {full ? (
          <div className="rounded-lg border border-warn-bg bg-warn-bg p-4 text-sm text-warn">
            <p className="font-medium">No te quedan accesos disponibles.</p>
            <p className="mt-1">
              Cada acceso extra cuesta $19/mes.{' '}
              <Link href="/dashboard/facturacion" className="underline">
                Añadir accesos
              </Link>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[15rem] flex-1">
              <label className="mb-1 block text-xs text-ink-soft">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="invite-email"
                placeholder="recepcion@minegocio.com"
                className="w-full rounded-lg border border-line px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-soft">Rol</label>
              <select
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value as TeamRoleKey)}
                data-testid="invite-role"
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                {(Object.keys(TEAM_ROLES) as TeamRoleKey[])
                  .filter((k) => k !== 'owner')
                  .map((k) => (
                    <option key={k} value={k}>
                      {TEAM_ROLES[k].label}
                    </option>
                  ))}
              </select>
            </div>
            {roleKey === 'profesional' && (
              <div>
                <label className="mb-1 block text-xs text-ink-soft">Su ficha</label>
                <select
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                >
                  <option value="">Sin vincular</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={invite}
              disabled={pending || !email.trim()}
              data-testid="invite-submit"
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
            >
              Invitar
            </button>
          </div>
        )}

        <p className="mt-2 text-xs text-ink-faint">{TEAM_ROLES[roleKey].description}</p>

        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        {notice && <p className="mt-2 text-sm text-success">{notice}</p>}
        {manualLink && (
          <div className="mt-3 rounded-lg border border-warn-bg bg-warn-bg p-3 text-sm text-warn">
            <p className="font-medium">La invitación se creó, pero el correo no salió.</p>
            <p className="mt-1">Copia este enlace y mándaselo tú:</p>
            <code className="mt-2 block break-all rounded bg-white/60 p-2 text-xs" data-testid="invite-link">
              {manualLink}
            </code>
          </div>
        )}
      </section>

      {/* Pendientes */}
      {invitations.length > 0 && (
        <section className="rounded-card border border-line bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Invitaciones pendientes</h2>
          <ul className="divide-y divide-line-row">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm text-ink">{i.email}</p>
                  <p className="text-xs text-ink-soft">
                    {TEAM_ROLES[roleKeyOf(i.role, i.resource_scope)].label} · caduca el{' '}
                    {new Date(i.expires_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => run(() => resendInvitation(i.email, roleKeyOf(i.role, i.resource_scope)))}
                    disabled={pending}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Reenviar
                  </button>
                  <button
                    onClick={() => run(() => revokeInvitation(i.id))}
                    disabled={pending}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Miembros */}
      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">Miembros</h2>
        <ul className="divide-y divide-line-row">
          {members.map((m) => {
            const key = roleKeyOf(m.role, m.resource_scope)
            const meta = TEAM_ROLES[key]
            const isMe = m.id === myId
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={`text-sm ${m.is_active ? 'text-ink' : 'text-ink-faint line-through'}`}>
                    {m.full_name || m.email || 'Sin nombre'}
                    {isMe && <span className="ml-1 text-xs text-ink-faint">(tú)</span>}
                    {!m.is_active && <span className="ml-1 text-xs">(desactivado)</span>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {m.email}
                    {m.resourceName && ` · ficha: ${m.resourceName}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isMe ? (
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                  ) : (
                    <select
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
                      className="rounded-lg border border-line px-2.5 py-1 text-xs"
                    >
                      {(Object.keys(TEAM_ROLES) as TeamRoleKey[]).map((k) => (
                        <option key={k} value={k}>
                          {TEAM_ROLES[k].label}
                        </option>
                      ))}
                    </select>
                  )}

                  {!isMe &&
                    (m.is_active ? (
                      <button
                        onClick={() => run(() => setMemberActive(m.id, false))}
                        disabled={pending}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => run(() => setMemberActive(m.id, true))}
                        disabled={pending}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Reactivar
                      </button>
                    ))}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
