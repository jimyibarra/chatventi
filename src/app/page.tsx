import { redirect } from 'next/navigation'

export default function Home() {
  // El middleware envía a /login si no hay sesión.
  redirect('/dashboard')
}
