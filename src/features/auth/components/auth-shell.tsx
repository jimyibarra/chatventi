import Link from 'next/link'
import { LinesShowcase } from './lines-showcase'
import { CHATVENTI, brandStyle, type Brand } from '@/features/marca/brand-shared'
import { BrandProvider } from '@/features/marca/brand-context'

// Armazón de acceso y alta (login, registro, recuperar, nueva contraseña,
// bienvenida e invitación), diseño «Líneas»:
//   · Computadora (≥lg): a la izquierda el panel de marca en el violeta del riel
//     del panel, con el plano de muestra; a la derecha el formulario.
//   · Celular: la misma barra violeta del panel arriba y el formulario debajo.
export function AuthShell({ children, brand = CHATVENTI }: { children: React.ReactNode; brand?: Brand }) {
  const home = brand.panelUrl ?? '/'
  return (
    <div className="cv-panel min-h-screen bg-surface text-ink lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]" style={brandStyle(brand)}>
      <aside className="hidden bg-brand-500 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:px-10 lg:py-9 xl:px-14">
        <Link href={home} className="flex w-fit items-center gap-3 rounded-[14px] focus-visible:outline-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.iconUrl} alt="" className="h-12 w-12 rounded-[14px] bg-white p-1.5" />
          <span className="text-[1.35rem] font-bold tracking-tight">{brand.name}</span>
        </Link>
        <div className="my-auto flex flex-col gap-8 py-10">
          <div>
            <p className="max-w-[19ch] text-balance text-[2.35rem] font-bold leading-[1.08] tracking-tight xl:text-[2.6rem]">
              {brand.partnerId ? 'Tu agenda y tu recepcionista con IA' : 'Tu recepcionista con IA que responde y agenda citas'}
            </p>
            <p className="mt-3 max-w-[44ch] text-[16.5px] leading-relaxed text-brand-50">
              {brand.partnerId ? `Entra con tu cuenta de ${brand.name}, desde «Mi agenda».` : 'Por WhatsApp, Telegram y tu web — 24/7, incluso mientras duermes.'}
            </p>
          </div>
          <LinesShowcase />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center bg-brand-500 px-4 py-2 text-white lg:hidden">
          <Link href={home} className="flex items-center gap-2 rounded-[10px] focus-visible:outline-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.iconUrl} alt="" className="h-8 w-8 rounded-[10px] bg-white p-1" />
            <span className="font-bold tracking-tight">{brand.name}</span>
          </Link>
        </header>
        <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-6 sm:justify-center sm:py-12">
          <div className="w-full max-w-[440px]">
            <BrandProvider brand={brand}>{children}</BrandProvider>
          </div>
        </main>
      </div>
    </div>
  )
}
