import Image from 'next/image'
import Link from 'next/link'

// Layout split de autenticación: panel de marca a la izquierda (gradiente
// azul→verde con el logotipo en tarjeta blanca flotante) y el formulario a
// la derecha. En móvil el panel se colapsa a un encabezado con el logo.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
      {/* Panel de marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4c3fd3] via-[#0e7bb8] to-[#16a34a] lg:flex lg:items-center lg:justify-center">
        {/* Orbes decorativos */}
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-1/4 top-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 mx-10 flex max-w-lg flex-col items-center gap-7">
          <div className="rounded-[28px] bg-white px-12 py-9 shadow-2xl shadow-black/25">
            <Image
              src="/brand/chatventi-logo.png"
              alt="ChatVenti"
              width={430}
              height={158}
              priority
            />
          </div>
          <p className="max-w-sm text-center text-[15px] font-medium leading-relaxed text-white/90">
            Tu recepcionista con IA que responde y agenda citas por WhatsApp,
            Telegram y tu web — 24/7, incluso mientras duermes.
          </p>
        </div>
      </aside>

      {/* Contenido (formularios) */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {/* Logo en móvil (el panel izquierdo no se ve) */}
        <Link href="/" className="mb-6 lg:hidden">
          <Image src="/brand/chatventi-logo.png" alt="ChatVenti" width={220} height={81} priority />
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
