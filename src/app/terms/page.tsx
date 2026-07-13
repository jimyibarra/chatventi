import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'

export const metadata: Metadata = {
  title: `Términos del Servicio · ${LEGAL.brand}`,
  description: `Términos y condiciones de uso de ${LEGAL.brand}.`,
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-3xl px-6 py-6">
        <Link href="/" className="text-lg font-bold text-ink">
          {LEGAL.brand}
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-ink">Términos del Servicio</h1>
        <p className="mt-2 text-sm text-ink-soft">Última actualización: {LEGAL.lastUpdated}</p>

        <div className="mt-8 space-y-6 text-ink-muted">
          <section>
            <h2 className="text-xl font-semibold text-ink">1. Aceptación</h2>
            <p>
              Al crear una cuenta o usar {LEGAL.brand} ({LEGAL.domain}) aceptas estos Términos. Si no
              estás de acuerdo, no uses el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">2. El servicio</h2>
            <p>
              {LEGAL.brand} es un software que permite a negocios atender clientes y gestionar citas
              por WhatsApp, Telegram y web, con apoyo de un asistente de IA. El servicio se ofrece
              mediante una suscripción de software; no cobramos por mensaje enviado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">3. Tu cuenta</h2>
            <p>
              Eres responsable de la veracidad de los datos de tu negocio, de la seguridad de tus
              credenciales y de la actividad realizada bajo tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">4. Uso aceptable</h2>
            <ul className="list-disc pl-6">
              <li>Cumplir las políticas de WhatsApp Business y de Meta, y las de Telegram.</li>
              <li>No enviar spam ni mensajes no solicitados; respetar el consentimiento del cliente.</li>
              <li>No usar el servicio para fines ilícitos, fraudulentos o dañinos.</li>
              <li>No suplantar identidades ni infringir derechos de terceros.</li>
            </ul>
            <p>
              El incumplimiento puede derivar en la suspensión de la cuenta y de los canales
              conectados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">5. Servicios de terceros</h2>
            <p>
              El servicio depende de plataformas de terceros (Meta/WhatsApp, Telegram, procesador de
              pagos, proveedor de IA e infraestructura). Su disponibilidad y políticas están fuera de
              nuestro control y su uso queda sujeto a sus respectivos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">6. Pagos</h2>
            <p>
              La suscripción se cobra según el plan contratado. Salvo que la ley exija lo contrario,
              los pagos no son reembolsables por periodos ya iniciados. Podemos actualizar los
              precios notificándote con antelación razonable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">7. Datos y privacidad</h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">8. Disponibilidad y responsabilidad</h2>
            <p>
              El servicio se ofrece &laquo;tal cual&raquo;. Hacemos esfuerzos razonables por
              mantenerlo disponible, pero no garantizamos una operación ininterrumpida ni libre de
              errores. En la medida permitida por la ley, nuestra responsabilidad se limita al monto
              pagado por el servicio en los últimos tres meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">9. Cancelación</h2>
            <p>
              Puedes cancelar tu suscripción en cualquier momento. Podemos suspender o terminar
              cuentas que incumplan estos Términos o las políticas de las plataformas conectadas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">10. Cambios y contacto</h2>
            <p>
              Podemos actualizar estos Términos; la versión vigente se publicará en esta página.
              Dudas:{' '}
              <a className="text-brand-600 hover:underline" href={`mailto:${LEGAL.contactEmail}`}>
                {LEGAL.contactEmail}
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
