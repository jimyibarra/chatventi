'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '../accept-actions'

export function AcceptInvitationForm({
  token,
  email,
  orgName,
}: {
  token: string
  email: string
  orgName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvitation({ token, fullName, password })
      if (res.ok) {
        // Ya quedó autenticado por la action: entra directo al panel.
        router.replace('/dashboard')
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink-muted">Correo</label>
        <input
          value={email}
          disabled
          data-testid="accept-email"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-soft"
        />
        <p className="mt-1 text-xs text-ink-faint">
          La invitación es para este correo y no se puede cambiar.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-muted">Tu nombre</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          data-testid="accept-name"
          placeholder="Ana García"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-muted">Crea tu contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && fullName.trim() && password.length >= 8) submit()
          }}
          data-testid="accept-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="accept-error">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending || !fullName.trim() || password.length < 8}
        data-testid="accept-submit"
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? 'Creando tu cuenta…' : `Unirme a ${orgName}`}
      </button>
    </div>
  )
}
