import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PhoneShot } from '@/features/guia/components/phone-shot'
import { Icon, type IconName } from '@/shared/components/ui/icon'

export const metadata: Metadata = {
  title: 'Conecta tu Facebook e Instagram · ChatVenti',
  description:
    'Guía paso a paso, con imágenes reales, para crear o entrar a tu Facebook, crear la página de tu negocio, preparar tu Instagram y conectarlos a ChatVenti.',
}

// La guía es una línea del Metro: cada paso es una estación con su color.
const LINE = ['#e0007a', '#0b5bd3', '#00a35c', '#5b4fe0', '#f08c00']

const STARTS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '#paso-1', icon: 'user', title: 'No tengo Facebook', text: 'Empieza por crear tu cuenta. Es gratis.' },
  { href: '#paso-2', icon: 'globe', title: 'Tengo Facebook, pero no la página de mi negocio', text: 'Crea la página y sigue desde ahí.' },
  { href: '#paso-4', icon: 'plug', title: 'Ya tengo la página de mi negocio', text: 'Ve directo a conectarla.' },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'En la ventana de Facebook no me aparece mi página',
    a: 'Solo aparecen las páginas donde eres administrador con acceso total. Si la creó otra persona, pídele que te dé ese acceso. Si Facebook te muestra lo que ya habías autorizado, elige editar el acceso y marca tu página.',
  },
  {
    q: 'Messenger funciona, pero Instagram no contesta',
    a: 'Revisa tres cosas en la app de Instagram: que sea cuenta profesional, que esté vinculada a tu página de Facebook y que «Permitir acceso a los mensajes» esté activado (paso 3).',
  },
  {
    q: 'Me dice que la página ya está conectada a otra cuenta de ChatVenti',
    a: 'Cada página solo puede estar en un negocio. Escríbenos a soporte@chatventi.com desde el correo de tu cuenta y la liberamos.',
  },
  {
    q: '¿Cuesta algo usar Instagram y Messenger?',
    a: 'No hay costo por mensaje en Instagram ni en Messenger. Vienen incluidos en todos los planes de ChatVenti.',
  },
  {
    q: '¿Lo puedo hacer desde el celular?',
    a: 'Sí, todo. Las imágenes de esta guía son de un celular.',
  },
]

function Station({
  n,
  id,
  title,
  lead,
  children,
  shots,
  last = false,
}: {
  n: number
  id: string
  title: string
  lead: string
  children: ReactNode
  shots?: ReactNode
  last?: boolean
}) {
  const color = LINE[n - 1]
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="relative grid scroll-mt-6 grid-cols-[44px_minmax(0,1fr)] gap-x-4 md:grid-cols-[56px_minmax(0,1fr)]">
      {/* Tramo de la línea y estación */}
      <div className="relative flex justify-center" aria-hidden>
        {!last && <span className="absolute bottom-[-8px] top-11 w-[7px] rounded-full md:top-14" style={{ background: color }} />}
        <span
          className="relative z-10 grid h-11 w-11 place-items-center rounded-full border-[6px] bg-white text-[17px] font-bold text-ink md:h-14 md:w-14 md:text-[20px]"
          style={{ borderColor: color }}
        >
          {n}
        </span>
      </div>
      <div className={`min-w-0 ${last ? '' : 'pb-12 md:pb-16'}`}>
        <h2 id={`${id}-t`} className="pt-1.5 text-[1.45rem] font-bold leading-tight tracking-tight text-ink [text-wrap:balance] md:pt-2.5 md:text-[1.75rem]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[16px] leading-relaxed text-ink-muted">{lead}</p>
        <div className={`mt-5 grid items-start gap-7 ${shots ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
          <div className="min-w-0 space-y-4">{children}</div>
          {shots && <div className="flex flex-wrap justify-center gap-6">{shots}</div>}
        </div>
      </div>
    </section>
  )
}

/** Pasos de una pantalla, en orden. */
function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-[16px] leading-relaxed text-ink">
          <span className="mt-[3px] grid h-[26px] w-[26px] place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  )
}

/** Ruta de menús tal como se lee en pantalla: Menú › Páginas › Crear. */
function Path({ parts }: { parts: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-1">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-ink-muted" />}
          <span className="rounded-[8px] bg-white px-2 py-0.5 text-[14.5px] font-semibold text-ink shadow-[0_1px_0_#dde2f0]">{p}</span>
        </span>
      ))}
    </span>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2.5 rounded-[16px] bg-brand-50 px-4 py-3 text-[15px] leading-relaxed text-brand-900">
      <Icon name="lightbulb" className="mt-0.5 h-5 w-5 flex-none" />
      <span>{children}</span>
    </p>
  )
}

export default function GuiaFacebookInstagramPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-[12px] font-bold tracking-tight text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/chatventi-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-[10px] bg-white p-1 shadow-[0_1px_0_#dde2f0]" />
          ChatVenti
        </Link>
        <Link href="/dashboard/conexiones" className="inline-flex min-h-[44px] items-center rounded-[13px] border-2 border-ink bg-white px-4 text-[15px] font-semibold text-ink hover:bg-brand-50 md:min-h-[40px]">
          Ir a Conexiones
        </Link>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 pb-20 md:px-6">
        <div className="max-w-[44rem] pt-4 md:pt-8">
          <h1 className="text-[2.1rem] font-bold leading-[1.05] tracking-tight text-ink [text-wrap:balance] md:text-[3rem]">
            Conecta tu Facebook e Instagram a ChatVenti
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-muted md:text-[18px]">
            Así tu recepcionista contesta, también ahí, los mensajes que te mandan a tu página y a tu Instagram, y agenda las citas.
            Toma unos 10 minutos y lo puedes hacer todo desde el celular.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2 text-[14.5px] font-semibold text-ink">
            {['Tu cuenta de Facebook', 'La página de tu negocio', 'Tu Instagram profesional (opcional)'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-[0_1px_0_#dde2f0]">
                <Icon name="check" className="h-4 w-4 text-[#0d9463]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-labelledby="empieza-t" className="mt-10 md:mt-12">
          <h2 id="empieza-t" className="text-[1.15rem] font-bold text-ink">
            ¿Dónde estás hoy?
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {STARTS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="group flex h-full items-start gap-3 rounded-[20px] bg-white p-4 shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)] transition-shadow duration-200 hover:shadow-[0_1px_0_#dde2f0,0_14px_30px_-12px_rgba(42,26,94,.32)]"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-brand-500 text-white">
                    <Icon name={s.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold leading-snug text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[14.5px] text-ink-muted">{s.text}</span>
                  </span>
                  <Icon name="arrowRight" className="ml-auto mt-2.5 h-4 w-4 flex-none text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 md:mt-16">
          <Station
            n={1}
            id="paso-1"
            title="Entra a Facebook, o crea tu cuenta"
            lead="Usa tu cuenta personal de Facebook. La página de tu negocio se crea dentro de ella, y tus clientes no ven tu perfil."
            shots={
              <>
                <PhoneShot
                  src="/guia/fb-iniciar-sesion.webp"
                  alt="Pantalla de inicio de Facebook en el celular, con los campos para entrar y el botón Crear cuenta nueva"
                  width={780}
                  height={1688}
                  tap={{ left: 2, top: 87, width: 96, height: 4.2, label: 'Si no tienes cuenta' }}
                  caption="facebook.com en el celular"
                />
                <PhoneShot
                  src="/guia/fb-crear-cuenta.webp"
                  alt="Pantalla Únete a Facebook con el botón Crear cuenta nueva"
                  width={780}
                  height={1688}
                  tap={{ left: 2, top: 46.2, width: 96, height: 4.4 }}
                  caption="Únete a Facebook"
                />
              </>
            }
          >
            <p className="text-[16px] font-semibold text-ink">Si ya tienes Facebook</p>
            <Steps items={['Abre la app de Facebook o entra a facebook.com.', 'Escribe tu correo o celular y tu contraseña, y toca «Iniciar sesión».', 'Listo: sigue en el paso 2.']} />
            <p className="pt-2 text-[16px] font-semibold text-ink">Si no tienes Facebook</p>
            <Steps
              items={[
                'En facebook.com toca «Crear cuenta nueva».',
                'Escribe tu nombre y apellido, tu fecha de nacimiento, tu celular o correo y una contraseña.',
                'Facebook te manda un código por SMS o correo: escríbelo para confirmar tu cuenta.',
              ]}
            />
            <Tip>Anota tu correo y tu contraseña de Facebook: los vas a necesitar en el paso 4.</Tip>
          </Station>

          <Station
            n={2}
            id="paso-2"
            title="Crea la página de tu negocio"
            lead="La página es la cara de tu negocio en Facebook: ahí te escriben tus clientes por Messenger. Si ya la tienes, salta al paso 3."
          >
            <Steps
              items={[
                <>
                  En la app de Facebook: <Path parts={['Menú', 'Páginas', 'Crear']} />. En la computadora entra a{' '}
                  <a className="font-semibold text-brand-700 underline underline-offset-2" href="https://www.facebook.com/pages/create" target="_blank" rel="noreferrer">
                    facebook.com/pages/create
                  </a>
                  .
                </>,
                'Nombre de la página: el nombre de tu negocio, tal como lo conocen tus clientes.',
                'Categoría: escribe tu giro y elige el que aparezca, por ejemplo «Barbería», «Dentista» o «Salón de belleza».',
                'Presentación: una línea de lo que haces. Toca «Crear página».',
                'Agrega tu logotipo, una portada, tu horario, tu teléfono y tu dirección. Así tu página se ve confiable.',
              ]}
            />
            <Tip>
              Tienes que ser administrador de la página con acceso total. Si la creó otra persona (tu agencia, un familiar), pídele que te dé ese acceso desde{' '}
              <Path parts={['Configuración', 'Acceso a la página']} />
            </Tip>
          </Station>

          <Station
            n={3}
            id="paso-3"
            title="Prepara tu Instagram (opcional)"
            lead="Si también quieres que la recepcionista conteste en Instagram, tu cuenta debe ser profesional y estar vinculada a tu página. Si solo quieres Messenger, salta al paso 4."
            shots={
              <PhoneShot
                src="/guia/ig-crear-cuenta.webp"
                alt="Pantalla para crear una cuenta de Instagram en el celular"
                width={780}
                height={1688}
                caption="Si aún no tienes Instagram: instagram.com o la app"
              />
            }
          >
            <Steps
              items={[
                <>
                  Hazla profesional. En la app de Instagram: <Path parts={['Tu perfil', 'Menú', 'Configuración y actividad', 'Tipo de cuenta y herramientas']} /> y toca «Cambiar a cuenta profesional». Elige «Negocio».
                </>,
                <>
                  Vincúlala a tu página: <Path parts={['Editar perfil', 'Página']} /> y elige la página de tu negocio.
                </>,
                <>
                  Deja entrar los mensajes: <Path parts={['Configuración y actividad', 'Mensajes y respuestas a historias', 'Herramientas conectadas']} /> y activa «Permitir acceso a los mensajes».
                </>,
              ]}
            />
            <Tip>Sin el tercer punto, Instagram no le entrega los mensajes a ChatVenti y la recepcionista no los ve.</Tip>
          </Station>

          <Station
            n={4}
            id="paso-4"
            title="Conéctalos en ChatVenti"
            lead="Un solo botón conecta tu página y, si la vinculaste, tu Instagram."
            shots={
              <>
                <PhoneShot
                  src="/guia/cv-conexiones.webp"
                  alt="Pantalla Conexiones de ChatVenti con el botón Conectar Facebook e Instagram"
                  width={716}
                  height={560}
                  tap={{ left: 3.5, top: 79.5, width: 83.5, height: 17 }}
                  caption="ChatVenti › Más › Conexiones"
                />
                <PhoneShot
                  src="/guia/fb-ventana-conectar.webp"
                  alt="Ventana de Facebook que pide iniciar sesión para conectar con ChatVenti"
                  width={780}
                  height={1688}
                  tap={{ left: 9, top: 48.3, width: 82, height: 5, label: 'Tu Facebook' }}
                  caption="La ventana que abre Facebook"
                />
              </>
            }
          >
            <Steps
              items={[
                <>
                  Entra a ChatVenti y ve a <Path parts={['Más', 'Conexiones']} />.
                </>,
                'En «Instagram y Messenger» toca «Conectar Facebook e Instagram».',
                'Se abre una ventana de Facebook. Si te pide entrar, escribe tu correo y contraseña de Facebook.',
                'Toca «Continuar». Marca la página de tu negocio y, si aparece, tu Instagram. Deja los permisos activados y confirma.',
                'Regresas a ChatVenti y verás «Messenger de la página» y «Mensajes directos de Instagram» como conectados.',
              ]}
            />
            <Tip>Facebook te pregunta qué puede hacer ChatVenti: solo leer y contestar los mensajes de esa página. No publica nada en tu nombre.</Tip>
          </Station>

          <Station
            n={5}
            id="paso-5"
            title="Pruébalo"
            lead="Pide a alguien que le escriba a tu página o a tu Instagram, o escríbele tú desde tu perfil personal."
            last
          >
            <Steps
              items={[
                'Escribe algo como «Hola, ¿tienen lugar mañana?».',
                'La recepcionista contesta en segundos con tus horarios libres.',
                <>
                  La conversación aparece en ChatVenti, en <Path parts={['Chats']} />, con el icono de Messenger o de Instagram.
                </>,
              ]}
            />
          </Station>
        </div>

        <section aria-labelledby="faq-t" className="mt-16 max-w-[48rem]">
          <h2 id="faq-t" className="text-[1.45rem] font-bold tracking-tight text-ink md:text-[1.75rem]">
            Si algo no sale
          </h2>
          <div className="mt-4 divide-y divide-line rounded-[20px] bg-white px-4 shadow-[0_1px_0_#dde2f0,0_10px_26px_-14px_rgba(42,26,94,.22)] md:px-5">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{f.q}</span>
                  <Icon name="chevronDown" className="h-5 w-5 flex-none text-ink-muted transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-[15.5px] leading-relaxed text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-[15px] text-ink-muted">
            ¿Te atoraste en otro paso? Escríbenos a <span className="font-semibold text-ink">soporte@chatventi.com</span> y te ayudamos.
          </p>
        </section>
      </main>
    </div>
  )
}
