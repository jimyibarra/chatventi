import type { Metadata } from 'next'
import { NewPasswordForm } from '@/features/auth/components/new-password-form'

export const metadata: Metadata = { title: 'Define tu contraseña' }

export default function NewPasswordPage() {
  return <NewPasswordForm />
}
