import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'

export const metadata: Metadata = {
  title: `Política de Privacidad · ${LEGAL.brand}`,
  description: `Cómo ${LEGAL.brand} recopila, usa y protege los datos personales.`,
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-3xl px-6 py-6">
        <Link href="/" className="text-lg font-bold text-ink">
          {LEGAL.brand}
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-ink">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-ink-soft">Última actualización: {LEGAL.lastUpdated}</p>

        <div className="mt-8 space-y-6 text-ink-muted">
          <section>
            <h2 className="text-xl font-semibold text-ink">1. Quiénes somos</h2>
            <p>
              {LEGAL.legalName} (&laquo;{LEGAL.brand}&raquo;, &laquo;nosotros&raquo;) opera la
              plataforma disponible en {LEGAL.domain}, un software que permite a negocios (por
              ejemplo peluquerías, clínicas y consultorios) atender a sus clientes y agendar citas
              a través de WhatsApp, Telegram y una página de reservas web, con apoyo de un asistente
              de inteligencia artificial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">2. Nuestro rol</h2>
            <p>
              Cuando un negocio usa {LEGAL.brand} para atender a sus propios clientes, el negocio
              actúa como <strong>responsable</strong> de esos datos y {LEGAL.brand} actúa como
              <strong> encargado del tratamiento</strong>, procesando la información siguiendo sus
              instrucciones. Respecto de los datos de la cuenta del negocio (su registro y uso de la
              plataforma), {LEGAL.brand} actúa como responsable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">3. Datos que recopilamos</h2>
            <ul className="list-disc pl-6">
              <li>
                <strong>Datos de la cuenta:</strong> nombre del negocio, nombre del titular, correo
                electrónico y datos de acceso.
              </li>
              <li>
                <strong>Datos de contactos y conversaciones:</strong> número de teléfono o
                identificador del cliente final, mensajes intercambiados, archivos multimedia y
                metadatos necesarios para la mensajería.
              </li>
              <li>
                <strong>Datos de citas:</strong> servicios, fechas, horarios, sucursal y notas.
              </li>
              <li>
                <strong>Datos de pago:</strong> gestionados por nuestro procesador de pagos; no
                almacenamos números completos de tarjeta.
              </li>
              <li>
                <strong>Datos técnicos:</strong> registros de acceso y uso para seguridad y soporte.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">4. Cómo usamos los datos</h2>
            <p>
              Prestar y operar el servicio (mensajería, agenda, recordatorios y asistente IA),
              autenticar el acceso, procesar cobros del software, brindar soporte, prevenir fraude y
              cumplir obligaciones legales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">
              5. WhatsApp, Telegram y proveedores
            </h2>
            <p>
              Para prestar el servicio compartimos datos con proveedores que actúan como
              subencargados, únicamente en lo necesario:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Meta Platforms (WhatsApp Business Platform):</strong> envío y recepción de
                mensajes de WhatsApp. Su uso se rige por las políticas de Meta.
              </li>
              <li>
                <strong>Telegram:</strong> envío y recepción de mensajes vía bots de Telegram.
              </li>
              <li>
                <strong>Supabase:</strong> base de datos, autenticación y almacenamiento.
              </li>
              <li>
                <strong>Proveedor de pagos:</strong> procesamiento de la suscripción del software.
              </li>
              <li>
                <strong>Proveedor de IA:</strong> generación de respuestas del asistente, acotadas
                al contexto del negocio.
              </li>
            </ul>
            <p>
              No vendemos datos personales ni los usamos con fines publicitarios de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">6. Conservación</h2>
            <p>
              Conservamos los datos mientras la cuenta esté activa y durante el tiempo necesario
              para cumplir obligaciones legales. El negocio puede solicitar la eliminación de los
              datos de sus contactos y conversaciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">7. Tus derechos</h2>
            <p>
              Puedes solicitar acceso, rectificación, eliminación u oposición al tratamiento de tus
              datos, así como la portabilidad, escribiendo a{' '}
              <a className="text-brand-600 hover:underline" href={`mailto:${LEGAL.privacyEmail}`}>
                {LEGAL.privacyEmail}
              </a>
              . Si eres cliente final de un negocio, dirígete primero a ese negocio como responsable
              de tus datos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">8. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito,
              aislamiento por organización y control de acceso) para proteger la información.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">9. Cambios</h2>
            <p>
              Podemos actualizar esta política. Publicaremos la versión vigente en esta página con
              su fecha de actualización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">10. Contacto</h2>
            <p>
              Para cualquier duda sobre privacidad, escríbenos a{' '}
              <a className="text-brand-600 hover:underline" href={`mailto:${LEGAL.privacyEmail}`}>
                {LEGAL.privacyEmail}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 border-t border-line-row pt-6 text-sm">
          <Link href="/" className="text-brand-600 hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  )
}
