'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '../accept-actions'
import { TurnstileWidget } from '@/features/auth/components/turnstile-widget'
import { Button } from '@/shared/components/ui/button'
import { Field, Input } from '@/shared/components/ui/field'
import { Notice } from '@/shared/components/ui/notice'

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
  // Captcha (inerte sin NEXT_PUBLIC_TURNSTILE_SITE_KEY). El alta autentica con
  // contraseña, así que GoTrue lo exige si el captcha de Supabase Auth está activo.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvitation({
        token,
        fullName,
        password,
        captchaToken: captchaToken ?? undefined,
      })
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
      <Field label="Correo" hint="La invitación es para este correo y no se puede cambiar.">
        <Input value={email} disabled data-testid="accept-email" />
      </Field>

      <Field label="Tu nombre">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          data-testid="accept-name"
          autoComplete="name"
          placeholder="Ana García"
        />
      </Field>

      <Field label="Crea tu contraseña">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && fullName.trim() && password.length >= 8) submit()
          }}
          data-testid="accept-password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
      </Field>

      <TurnstileWidget onToken={setCaptchaToken} />

      {error && (
        <Notice tone="danger" size="sm" testId="accept-error">
          {error}
        </Notice>
      )}

      <Button
        onClick={submit}
        disabled={pending || !fullName.trim() || password.length < 8}
        data-testid="accept-submit"
        className="w-full"
      >
        {pending ? 'Creando tu cuenta…' : `Unirme a ${orgName}`}
      </Button>
    </div>
  )
}
