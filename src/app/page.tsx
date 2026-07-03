import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold text-gray-900">{LEGAL.brand}</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="font-medium text-gray-600 hover:text-gray-900">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Crear mi negocio
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main>
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Agenda + recepcionista IA
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Tu recepcionista con IA que agenda citas por WhatsApp
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            {LEGAL.brand} atiende a tus clientes por WhatsApp, Telegram y web las 24 horas:
            responde, agenda, reagenda y envía recordatorios. Para peluquerías, dentistas,
            clínicas y cualquier negocio de citas.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
            >
              Empezar gratis
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            {[
              {
                title: 'Agenda inteligente',
                body: 'Tus clientes reservan solos por chat. Sin llamadas, sin dobles reservas.',
              },
              {
                title: 'Recepcionista IA',
                body: 'Responde dudas y agenda 24/7, acotada a tu negocio y tus servicios.',
              },
              {
                title: 'Omnicanal',
                body: 'WhatsApp, Telegram y una página de reservas con tu marca, en un solo lugar.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-gray-500 sm:flex-row">
          <span>
            © 2026 {LEGAL.legalName}
          </span>
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-900">
              Privacidad
            </Link>
            <Link href="/terms" className="hover:text-gray-900">
              Términos
            </Link>
            <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-gray-900">
              Contacto
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
