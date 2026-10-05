import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { PhoneShot } from '@/features/guia/components/phone-shot'
import { GuideFaq, GuideTop, Path, Station, Steps, Tip } from '@/features/guia/components/guide-parts'
import { Icon, type IconName } from '@/shared/components/ui/icon'

export const metadata: Metadata = {
  title: 'Conecta tu Facebook e Instagram · ChatVenti',
  description:
    'Guía paso a paso, con imágenes reales, para crear o entrar a tu Facebook, crear la página de tu negocio, preparar tu Instagram y conectarlos a ChatVenti.',
}

const STARTS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '#paso-1', icon: 'user', title: 'No tengo Facebook', text: 'Empieza por crear tu cuenta. Es gratis.' },
  { href: '#paso-2', icon: 'globe', title: 'Tengo Facebook, pero no la página de mi negocio', text: 'Crea la página y sigue desde ahí.' },
  { href: '#paso-4', icon: 'plug', title: 'Ya tengo la página de mi negocio', text: 'Ve directo a conectarla.' },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Facebook dice «Este contenido no está disponible en este momento»',
    a: 'Te pasa al crear la página si estás usando Facebook como una página (por ejemplo, la de tu negocio). Toca tu foto, arriba a la derecha, elige tu perfil personal y vuelve a intentarlo.',
  },
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

export default function GuiaFacebookInstagramPage() {
  return (
    <div className="min-h-screen">
      <GuideTop />

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
            stack
            shots={
              <>
                <PhoneShot
                  src="/guia/fb-crear-pagina.webp"
                  alt="Formulario Crear una página de Facebook con nombre, categoría y presentación"
                  width={294}
                  height={664}
                  frame="screen"
                  maxWidth={290}
                  tap={{ left: 4, top: 88.6, width: 92, height: 5.4, label: 'Al terminar' }}
                  caption="Crear una página, en la computadora"
                />
                <PhoneShot
                  src="/guia/fb-cambiar-perfil.webp"
                  alt="Menú de la foto de Facebook con la página y el perfil personal para cambiar entre ellos"
                  width={290}
                  height={166}
                  frame="screen"
                  maxWidth={290}
                  tap={{ left: 4, top: 39, width: 92, height: 28, label: 'Tu perfil personal' }}
                  caption="Si ves «Este contenido no está disponible»"
                />
              </>
            }
          >
            <Steps
              items={[
                <>
                  En la app de Facebook: <Path parts={['Menú', 'Páginas', 'Crear']} />. En la computadora, con tu perfil personal, entra a{' '}
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
              ¿Facebook dice «Este contenido no está disponible en este momento»? Estás usando Facebook como una página, y desde una página no se
              pueden crear otras. Toca tu foto, arriba a la derecha, elige tu perfil personal y vuelve a abrir el enlace.
            </Tip>
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
            stack
            shots={
              <>
                <PhoneShot
                  src="/guia/ig-crear-cuenta.webp"
                  alt="Pantalla para crear una cuenta de Instagram en el celular"
                  width={780}
                  height={1688}
                  caption="Si aún no tienes Instagram: instagram.com o la app"
                />
                <PhoneShot
                  src="/guia/fb-cuentas-vinculadas.webp"
                  alt="Cuentas vinculadas de una página de Facebook con Instagram conectado"
                  width={585}
                  height={185}
                  frame="screen"
                  maxWidth={340}
                  tap={{ left: 3.5, top: 31, width: 93, height: 30, label: 'Así se ve vinculado' }}
                  caption="Facebook › Configuración › Cuentas vinculadas"
                />
              </>
            }
          >
            <Steps
              items={[
                <>
                  Hazla profesional. En la app de Instagram: <Path parts={['Tu perfil', 'Menú', 'Configuración y actividad', 'Tipo de cuenta y herramientas']} /> y toca «Cambiar a cuenta profesional». Elige «Negocio».
                </>,
                <>
                  Vincúlala a tu página: <Path parts={['Editar perfil', 'Página']} /> y elige la página de tu negocio. También se puede desde Facebook, usando tu página:{' '}
                  <Path parts={['Configuración', 'Cuentas vinculadas', 'Instagram']} />
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
            lead="Un solo botón conecta tu página y, si la vinculaste, tu Instagram. Estas son las pantallas, en orden."
            shotsBelow
            shots={
              <>
                <PhoneShot
                  src="/guia/cv-conexiones.webp"
                  alt="Pantalla Conexiones de ChatVenti con el botón Conectar Facebook e Instagram"
                  width={716}
                  height={560}
                  maxWidth={260}
                  tap={{ left: 3.5, top: 79.5, width: 83.5, height: 17 }}
                  caption="1 · ChatVenti › Más › Conexiones"
                />
                <PhoneShot
                  src="/guia/fb-ventana-conectar.webp"
                  alt="Ventana de Facebook que pide iniciar sesión para conectar con ChatVenti"
                  width={780}
                  height={1688}
                  maxWidth={260}
                  tap={{ left: 9, top: 48.3, width: 82, height: 5, label: 'Si te lo pide' }}
                  caption="2 · Entra con tu Facebook"
                />
                <PhoneShot
                  src="/guia/fb-elegir-pagina.webp"
                  alt="Ventana de Facebook para elegir la página que se comparte con ChatVenti"
                  width={460}
                  height={548}
                  frame="screen"
                  maxWidth={330}
                  tap={{ left: 12, top: 65.8, width: 85, height: 7.6, label: 'Marca tu página' }}
                  caption="3 · En «Página», marca la de tu negocio"
                />
                <PhoneShot
                  src="/guia/fb-pagina-elegida.webp"
                  alt="Ventana de Facebook con la página y la cuenta de Instagram elegidas"
                  width={460}
                  height={548}
                  frame="screen"
                  maxWidth={330}
                  tap={{ left: 79.6, top: 88.9, width: 18, height: 6.6, label: 'Siguiente' }}
                  caption="4 · Revisa página e Instagram"
                />
                <PhoneShot
                  src="/guia/fb-permisos.webp"
                  alt="Ventana de Facebook con lo que se compartirá con ChatVenti y el botón Confirmar"
                  width={460}
                  height={548}
                  frame="screen"
                  maxWidth={330}
                  tap={{ left: 72, top: 89.6, width: 20, height: 7.4, label: 'Confirmar' }}
                  caption="5 · Confirma"
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
                'En «Selecciona los activos comerciales…»: en «Página» marca la de tu negocio y en «Cuenta de Instagram» elige la tuya. Si te pide un portafolio empresarial, deja el que aparece o crea uno con el nombre de tu negocio. Toca «Siguiente».',
                'Revisa lo que se compartirá con ChatVenti y toca «Confirmar».',
                'Regresas a ChatVenti y verás «Messenger de la página» y «Mensajes directos de Instagram» como conectados.',
              ]}
            />
            <Tip>ChatVenti pide ver tu página y leer y contestar los mensajes de Messenger e Instagram. No pide permiso para publicar nada en tu nombre.</Tip>
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

        <GuideFaq items={FAQ} />
      </main>
    </div>
  )
}
