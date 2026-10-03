import { AuthShell } from '@/features/auth/components/auth-shell'

// Acceso (login, registro, recuperar y nueva contraseña) en diseño «Líneas».
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
