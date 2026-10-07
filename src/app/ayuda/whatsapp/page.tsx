import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { GuideFaq, GuideTop, Path, Station, Steps, Tip } from '@/features/guia/components/guide-parts'
import { Icon, type IconName } from '@/shared/components/ui/icon'
import { currentBrand } from '@/features/marca/brand'

export const metadata: Metadata = {
  title: 'Conecta tu WhatsApp',
  description:
    'Guía paso a paso para elegir el número, conectar tu WhatsApp a tu agenda con la conexión oficial de Meta y dejar listos los recordatorios.',
}

const STARTS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '#paso-1', icon: 'phone', title: 'Aún no tengo el número', text: 'Empieza por elegir uno. Un chip de prepago sirve.' },
  { href: '#paso-1', icon: 'whatsapp', title: 'Mi número está en la app de WhatsApp', text: 'Primero hay que liberarlo de la app.' },
  { href: '#paso-3', icon: 'plug', title: 'Ya tengo un número libre', text: 'Ve directo a conectarlo.' },
]

const faq = (b: string, support: string): { q: string; a: ReactNode }[] => [
  {
    q: 'Meta dice que el número ya está registrado',
    a: 'Ese número sigue activo en la app de WhatsApp, en WhatsApp Business o con otro proveedor. Bórralo de la app (paso 1) o usa otro número.',
  },
  {
    q: `${b} dice que el número ya está conectado a otra cuenta`,
    a: `Cada número solo puede estar en un negocio de ${b}. Escríbenos a ${support} desde el correo de tu cuenta y lo liberamos.`,
  },
  {
    q: 'No me llega el código',
    a: 'Pide el código por llamada en vez de SMS y revisa que el chip tenga señal. Si es un teléfono fijo, elige siempre llamada.',
  },
  {
    q: 'Dice que la autorización de Meta caducó',
    a: 'Al final del proceso, Meta da 30 segundos para terminar la conexión. Vuelve a tocar «Conectar WhatsApp» y elige la cuenta que ya creaste.',
  },
  {
    q: 'Mi número quedó «Pendiente de activación»',
    a: 'Meta todavía no termina de registrarlo, casi siempre porque falta verificarlo. Vuelve a tocar «Conectar WhatsApp» con el mismo número. Si sigue igual, escríbenos.',
  },
  {
    q: '¿Puedo seguir usando la app de WhatsApp con ese número?',
    a: `No. El número pasa a la plataforma oficial de Meta y tus conversaciones las ves en ${b}, en Chats, desde el celular o la computadora.`,
  },
  {
    q: '¿Cuánto cuestan los mensajes?',
    a: `Meta los cobra directo a la cuenta de WhatsApp de tu negocio: cada número tiene 1,000 mensajes de servicio gratis al mes (las respuestas a quien te escribe). Los recordatorios sí los cobra Meta, por mensaje y según tu país. ${b} no les añade nada.`,
  },
]

export default async function GuiaWhatsAppPage() {
  const brand = await currentBrand()
  const b = brand.name
  return (
    <div className="min-h-screen">
      <GuideTop brand={brand} />
      <main className="mx-auto max-w-[1080px] px-4 pb-20 md:px-6">
        <div className="max-w-[44rem] pt-4 md:pt-8">
          <h1 className="text-[2.1rem] font-bold leading-[1.05] tracking-tight text-ink [text-wrap:balance] md:text-[3rem]">
            Conecta tu WhatsApp a {b}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-muted md:text-[18px]">
            Así tu recepcionista contesta y agenda por el WhatsApp de tu negocio, con la conexión oficial de Meta. Se hace en unos
            minutos, desde la computadora o el celular.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2 text-[14.5px] font-semibold text-ink">
            {['Tu cuenta de Facebook', 'Un número que reciba SMS o llamada', 'El nombre de tu negocio'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-[0_1px_0_#dde2f0]">
                <Icon name="check" className="h-4 w-4 text-[#0d9463]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-labelledby="empieza-t" className="mt-10 md:mt-12">
          <h2 id="empieza-t" className="text-[1.15rem] font-bold text-ink">¿Dónde estás hoy?</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {STARTS.map((s) => (
              <li key={s.title}>
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

        <div className="mt-12 max-w-[48rem] md:mt-16">
          <Station n={1} id="paso-1" title="Elige el número" lead="Será el número de tu recepcionista. Debe poder recibir un SMS o una llamada y no estar activo en la app de WhatsApp ni en WhatsApp Business.">
            <Steps
              items={[
                'Lo más sencillo es un chip de prepago nuevo, solo para tu negocio. Un teléfono fijo también sirve: Meta te llama para verificarlo.',
                <>
                  Si ese número ya está en la app de WhatsApp, primero borra esa cuenta desde la app: <Path parts={['Ajustes', 'Cuenta', 'Eliminar cuenta']} />.
                  Antes respalda tus chats si los quieres conservar.
                </>,
                'Mantén el chip en un teléfono con señal mientras haces la conexión: ahí llega el código.',
              ]}
            />
            <Tip>Después de conectarlo, ese número ya no se usa en la app de WhatsApp: tus conversaciones las ves en {b}, desde el celular o la computadora.</Tip>
          </Station>

          <Station n={2} id="paso-2" title="Ten a la mano tu Facebook y los datos del negocio" lead="La ventana de Meta te pide entrar con tu Facebook y crear (o elegir) el portafolio de tu negocio y su cuenta de WhatsApp Business.">
            <Steps
              items={[
                'Tu correo y contraseña de Facebook. Usas tu perfil personal; tus clientes no lo ven.',
                'El nombre de tu negocio, el país y, si tienes, su sitio web o página de Facebook.',
                'El nombre que verán tus clientes en WhatsApp: el de tu negocio, tal como lo conocen.',
                'La categoría de tu negocio. Meta te da una lista para elegir.',
              ]}
            />
            <Tip>Meta revisa que el nombre visible corresponda a tu negocio. Evita nombres genéricos como «Citas» o «Recepción».</Tip>
          </Station>

          <Station n={3} id="paso-3" title={`Conéctalo en ${b}`} lead={`Un solo botón abre la ventana oficial de Meta. Solo el dueño de la cuenta de ${b} puede hacerlo.`}>
            <Steps
              items={[
                <>
                  Entra a {b} y ve a <Path parts={['Más', 'Conexiones']} />.
                </>,
                'En «WhatsApp» toca «Conectar WhatsApp». Se abre una ventana de Meta; entra con tu Facebook si te lo pide.',
                'Elige el portafolio comercial de tu negocio o crea uno con sus datos.',
                'Crea la cuenta de WhatsApp Business (o elige la que ya tienes) y escribe el nombre visible y la categoría.',
                'Escribe tu número, elige SMS o llamada y escribe el código de 6 dígitos que te llega.',
                `Revisa lo que se compartirá con ${b} y confirma.`,
                `Regresas a ${b} y tu número aparece como «Activo». Si dice «Pendiente de activación», espera unos minutos o vuelve a tocar «Conectar WhatsApp».`,
              ]}
            />
          </Station>

          <Station n={4} id="paso-4" title="Agrega tu forma de pago en Meta" lead="Las respuestas a quien te escribe tienen 1,000 mensajes gratis al mes por número; los recordatorios los cobra Meta por mensaje. Para que salgan, tu cuenta de WhatsApp necesita una tarjeta.">
            <Steps
              items={[
                'Entra a business.facebook.com con el mismo Facebook y abre el Administrador de WhatsApp.',
                'En la sección de pagos, agrega la tarjeta de tu negocio.',
              ]}
            />
            <Tip>{b} no cobra por mensaje ni ve tu tarjeta: el cobro es directo entre Meta y tu negocio.</Tip>
          </Station>

          <Station n={5} id="paso-5" title="Pruébalo" lead="Escríbele a tu número desde otro celular, como si fueras un cliente." last>
            <Steps
              items={[
                'Escribe algo como «Hola, ¿tienen lugar mañana?».',
                'La recepcionista contesta en segundos con tus horarios libres.',
                <>
                  La conversación aparece en {b}, en <Path parts={['Chats']} />.
                </>,
              ]}
            />
            <Tip>En Conexiones verás «Mensajes automáticos por WhatsApp»: las plantillas de recordatorios que {b} pide por ti. Meta las aprueba en unos minutos.</Tip>
          </Station>
        </div>

        <GuideFaq items={faq(b, brand.supportEmail)} supportEmail={brand.supportEmail} />
      </main>
    </div>
  )
}
