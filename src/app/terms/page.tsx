import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { LEGAL } from '@/shared/constants/legal'

export const metadata: Metadata = {
  title: `Términos y Condiciones · ${LEGAL.brand}`,
  description: `Términos y condiciones de uso de ${LEGAL.brand}.`,
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto max-w-3xl px-6 py-6">
        <Link href="/" className="inline-flex items-center">
          <Image src="/brand/chatventi-logo.png" alt={LEGAL.brand} width={180} height={66} />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-ink">Términos y Condiciones para Usuarios</h1>
        <p className="mt-2 text-sm text-ink-soft">Última actualización: {LEGAL.lastUpdated}</p>

        <div className="mt-8 space-y-8 text-ink-muted">
          <S title="1. Acerca de estos términos">
            <p>
              ChatVenti (&quot;ChatVenti&quot;/&quot;nosotros&quot;) es el propietario y operador del
              servicio de software de agenda y recepcionista con inteligencia artificial ChatVenti
              (&quot;Servicio&quot;). Hemos desarrollado un portal (&quot;Portal&quot;) proporcionado
              a través de nuestro sitio web en chatventi.com (&quot;Sitio&quot;) y nuestra aplicación
              web (&quot;Aplicación&quot;) para proporcionarle los Servicios. Estos Términos
              establecen los términos y condiciones de su uso del Servicio. Su uso del Servicio está
              condicionado expresamente a su aceptación de estos Términos. Al registrarse para
              utilizar el Servicio, usted incondicionalmente acuerda y acepta estar legalmente
              obligado por estos Términos, y celebrar un acuerdo legalmente vinculante con nosotros
              basado en estos Términos, incluida nuestra{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline">
                Política de privacidad
              </Link>{' '}
              y el acuerdo de nivel de servicio (&quot;Acuerdo de Nivel de Servicio&quot;)
              proporcionado al final de estos Términos (colectivamente, el &quot;Acuerdo&quot;).
            </p>
          </S>

          <S title="2. Cambios a estos Términos o los Servicios">
            <p>
              ChatVenti se reserva el derecho de modificar estos Términos en cualquier momento. Le
              avisaremos de nuestros nuevos términos o le notificaremos de cualquier cambio a través
              de nuestro Portal, Sitio o Aplicación. Su uso continuo de este Servicio después de ser
              modificados los Términos constituirá que está de acuerdo y acepta estar legalmente
              obligado por esos cambios.
            </p>
          </S>

          <S title="3. Sobre el Servicio">
            <p>
              El Servicio le brinda una agenda de citas en línea y un asistente
              (&quot;recepcionista&quot;) con inteligencia artificial que atiende a sus clientes por
              WhatsApp, Telegram y su página de reservas web. Cuando se registre para utilizar
              nuestro Servicio, le proporcionaremos una cuenta para utilizar el Servicio
              (&quot;Cuenta&quot;). Solo los usuarios que se hayan registrado a través de nuestro
              Portal y tengan una Cuenta (&quot;Usuarios&quot;) pueden utilizar el Servicio. El envío
              y la recepción de mensajes por WhatsApp dependen de la API oficial de WhatsApp Business
              (Meta) y de que usted conecte y mantenga su propio número y cuenta de WhatsApp
              Business; ChatVenti no es responsable de las decisiones, restricciones, suspensiones o
              tarifas que Meta u otros proveedores de mensajería apliquen a su cuenta o número.
            </p>
          </S>

          <S title="4. Concesión de licencia">
            <p>
              Por la presente, ChatVenti le otorga un derecho limitado, no exclusivo e intransferible
              para usar el Servicio siempre que cumpla con sus obligaciones en virtud del Acuerdo,
              que incluyen lo siguiente:
            </p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                ChatVenti puede, a su entera y absoluta discreción, sin previo aviso y sin
                responsabilidad, rechazar, prevenir, descontinuar o suspender su Cuenta y/o su uso
                del Servicio si, a su sola discreción, ChatVenti opina que su uso no cumple con las
                especificaciones o pautas de ChatVenti, o que ChatVenti puede considerar
                inapropiado, ilegal o perjudicial para sus intereses. Si ChatVenti ejerce su
                discreción en virtud de este párrafo, no tendrá la responsabilidad de reembolsar
                ninguna parte de sus suscripciones prepagadas, si corresponde. Sin limitar ni
                renunciar a ningún derecho que ChatVenti pueda tener según la ley o estos Términos,
                ChatVenti se reserva el derecho de deducir cualquier costo, daño o gasto en el que
                haya incurrido en relación con dicho uso inapropiado, ilegal o dañino de sus
                suscripciones prepagadas no utilizadas, si las hubiera, o de reclamarlo por
                cualquier otro medio.
              </li>
              <li>
                Acepta cumplir con las políticas o directrices que ChatVenti pueda introducir o
                modificar de vez en cuando, incluidas las políticas de las plataformas de mensajería
                que usted conecte (por ejemplo, las Políticas de Comercio y de Mensajería de
                WhatsApp/Meta).
              </li>
              <li>
                Usted acepta que no hará ni hará que terceros: (a) modifiquen, interrumpan o
                interfieran con el Servicio, los servidores de soporte o las redes, ya sea
                manualmente o mediante el uso de scripts, virus o gusanos; (b) modificar, adaptar,
                traducir, realizar ingeniería inversa, descifrar, descompilar, reproducir, duplicar,
                copiar, deconstruir, vender, comercializar o revender el Servicio; (c) sobrecargar
                excesivamente los sistemas que ChatVenti utiliza para proporcionar el Servicio; o
                (d) proporcionar acceso o proporcionar cualquier parte del Servicio a un tercero.
              </li>
              <li>
                No enviará ni transmitirá ningún material que infrinja los derechos de propiedad
                intelectual de terceros, ni utilizará el Servicio para enviar comunicaciones no
                solicitadas (spam) o contrarias a la ley.
              </li>
              <li>No deberá crear una identidad falsa ni enviar información inexacta, falsa o engañosa.</li>
              <li>
                ChatVenti puede, a su entera y absoluta discreción y sin previo aviso, modificar,
                suspender, variar o retirar el Servicio, estos Términos, Portal, Sitio y/o
                Aplicación en cualquier momento.
              </li>
              <li>
                Usted será el único responsable de su uso del Servicio, Portal, Sitio y Aplicación,
                y deberá indemnizar a ChatVenti y mantenerla indemne de todas las pérdidas, costos y
                daños incurridos por ChatVenti en relación con cualquier reclamo de terceros contra
                ChatVenti relacionado con su uso del Servicio, y con su incumplimiento de estos
                Términos o de cualquier política o pauta de ChatVenti.
              </li>
              <li>
                Usted declara, garantiza y se compromete con ChatVenti a que en todo momento: (a)
                tiene todos los derechos, consentimientos, licencias y permisos necesarios para
                utilizar los materiales, gráficos, logotipos, videos, datos o información que
                ingresa en el Servicio (&quot;Su Contenido&quot;), incluidos los datos de contacto de
                sus clientes; y (b) todo Su Contenido cumple con las leyes y regulaciones aplicables
                y no viola los derechos de ningún tercero.
              </li>
              <li>
                Usted declara y garantiza que tiene todos los derechos, poder y autoridad para
                aceptar estos Términos y cumplir con las obligaciones acordadas, y que al hacerlo no
                viola ningún acuerdo u obligación con terceros, ni ninguna ley, norma o reglamento
                aplicable.
              </li>
              <li>
                Usted acepta que ChatVenti puede, pero no está obligada a, utilizar el nombre y el
                logotipo de su empresa y referirse a usted como usuario del Servicio en publicidad,
                comunicados de prensa o material de marketing. Si desea utilizar las marcas de
                ChatVenti, debe obtener su consentimiento previo por escrito.
              </li>
              <li>
                Usted acepta que es el único responsable de obtener el hardware, software y
                conectividad que necesite para acceder y utilizar el Servicio.
              </li>
              <li>
                Usted acepta que ChatVenti es propietaria y tiene derecho a utilizar cualquier
                comentario que proporcione sobre el Servicio, incluso para mejorar productos y
                servicios existentes o crear nuevos. ChatVenti se reserva todos los derechos,
                incluida la propiedad intelectual, sobre el Servicio, el Sitio y la Aplicación que
                no se le otorguen expresamente en estos Términos. Por la presente otorga a ChatVenti
                una licencia mundial, libre de regalías y no exclusiva para alojar, procesar,
                adaptar y usar Su Contenido con el fin de proporcionarle el Servicio.
              </li>
            </ol>
          </S>

          <S title="5. Condiciones de pago">
            <p>
              Al crear una Cuenta y suscribirse al Servicio o al renovar su suscripción, usted acepta
              los cargos aplicables por el plan que haya solicitado (plan base y, en su caso, módulo
              de recepcionista IA por volumen de conversaciones y complementos). Los pagos se
              procesan a través de nuestro procesador de pagos; usted acepta cumplir con las
              condiciones de pago que ChatVenti establezca. La suscripción puede renovarse
              automáticamente a su vencimiento a las tarifas vigentes en el momento de la
              renovación. Para suscriptores con tarjeta registrada, las tarifas de renovación se
              cargarán a esa tarjeta salvo cancelación previa realizada con las herramientas
              disponibles en su Cuenta. Los precios pueden cotizarse sin incluir impuestos; usted
              acepta que ChatVenti cobre los impuestos que la ley aplicable le obligue a trasladar.
              Si tiene pagos vencidos o saldo pendiente, ChatVenti puede suspender el Servicio y/o
              el soporte hasta que se liquiden. La suscripción de ChatVenti es por negocio
              (organización); el uso para más de un negocio requiere suscripciones adicionales o un
              acuerdo por escrito con ChatVenti, de lo contrario su cuenta podrá ser suspendida o
              cancelada. Todos los cargos por suscripción son no reembolsables una vez realizado
              el pago, salvo que la legislación aplicable exija lo contrario.
            </p>
          </S>

          <S title="6. Duración y rescisión">
            <p>
              ChatVenti tendrá derecho a rescindir el Acuerdo, sin previo aviso, si usted incumple
              cualquier disposición del Acuerdo. El Acuerdo y su capacidad para utilizar el Servicio
              también terminarán automáticamente al vencimiento de su suscripción. Después de la
              terminación, ChatVenti puede, a su entera discreción, conservar los datos que haya
              cargado en sus sistemas, incluidos Sus Datos y Su Contenido; sin embargo, usted acepta
              que ChatVenti no tiene obligación de mantener su Cuenta o sus datos después de la
              terminación. Si la terminación se debe a la falta de renovación oportuna, podrá
              reactivar su Cuenta y acceder a sus datos si ChatVenti habilita la renovación en tales
              circunstancias, previo pago de las tarifas correspondientes. Si no renueva su cuenta,
              ChatVenti puede eliminar permanentemente su Cuenta y los datos asociados.
            </p>
          </S>

          <S title="7. Privacidad de datos">
            <p>
              Usted o sus clientes, según corresponda, son los propietarios de los datos que cargue
              en el Servicio (&quot;Sus Datos&quot;). Usted acepta que ChatVenti es propietaria de
              los datos que no sean Sus Datos, incluidos los datos generados por el sistema o los
              datos agregados y anonimizados derivados del uso del Servicio (&quot;Datos de
              ChatVenti&quot;), que ChatVenti puede usar para operar, mejorar o diseñar productos y
              servicios, sujeto a nuestra Política de privacidad. Al utilizar el Servicio, es
              posible que procesemos datos personales de sus clientes (por ejemplo, nombre, teléfono
              y mensajes); en tal caso usted es el responsable (controlador) y ChatVenti el
              encargado (procesador) del tratamiento. Si procesamos datos personales en su nombre,
              haremos lo siguiente:
            </p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>Procesar esos datos personales solo conforme al Acuerdo, salvo requerimiento legal.</li>
              <li>
                Mantener medidas técnicas y organizativas apropiadas para proteger los datos
                personales contra el procesamiento no autorizado o ilegal y contra su pérdida,
                destrucción o daño accidental, teniendo en cuenta el estado de la técnica y el costo
                de implementación.
              </li>
              <li>
                No transferir datos personales fuera del sistema salvo con garantías adecuadas y en
                cumplimiento de la legislación de protección de datos aplicable.
              </li>
              <li>
                Ayudarle a responder solicitudes de los titulares de datos y a cumplir sus
                obligaciones en materia de seguridad, notificación de incidentes y evaluaciones de
                impacto.
              </li>
              <li>Notificarle sin demora indebida cuando tengamos conocimiento de una violación de datos personales.</li>
              <li>Asegurar que nuestro personal mantenga la confidencialidad de los datos personales.</li>
              <li>
                Según sus instrucciones por escrito, eliminar o devolver los datos personales al
                finalizar el Acuerdo, salvo que la ley exija su conservación.
              </li>
              <li>
                Mantener registros que demuestren el cumplimiento de la legislación de protección de
                datos. Usted consiente que ChatVenti designe subencargados (por ejemplo, proveedores
                de infraestructura en la nube, procesamiento de pagos y APIs de mensajería e
                inteligencia artificial) para almacenar y procesar datos; ChatVenti seguirá siendo
                responsable de los actos y omisiones de dichos subencargados.
              </li>
            </ol>
          </S>

          <S title="8. Tu cuenta">
            <p>
              La responsabilidad de mantener seguras y confidenciales las contraseñas e
              identificadores de usuario que ChatVenti le emita recae únicamente en usted y en los
              empleados, representantes y agentes a quienes se les confíen. Si detecta un acceso no
              autorizado a su Cuenta o un uso indebido de sus credenciales, debe cambiar sus
              contraseñas y/o solicitar la deshabilitación de su Cuenta lo antes posible. Usted es
              el único responsable de las acciones y omisiones de las personas que designe como
              usuarios o administradores de su Cuenta, y acepta que ChatVenti puede aceptar
              instrucciones de dichas personas hasta que se le notifique lo contrario. Asimismo, es
              responsable de cualquier uso de su Cuenta por cualquier persona en posesión de sus
              credenciales. Sujeto a nuestra Política de privacidad y al Acuerdo de Nivel de
              Servicio, usted reconoce que ChatVenti puede acceder a su Cuenta para operar, mantener
              y dar soporte al Servicio.
            </p>
          </S>

          <S title="9. Indemnización">
            <p>
              Si ChatVenti y/o cualquiera de sus afiliadas (colectivamente, las &quot;Partes
              Indemnizadas&quot;) toman medidas para hacer cumplir estos Términos, usted acepta
              indemnizar y eximir de responsabilidad a las Partes Indemnizadas, sus afiliadas y sus
              respectivos funcionarios, directores, empleados y agentes frente a todos los reclamos,
              pérdidas, costos, gastos, causas de acción o demandas, incluidos honorarios legales y
              contables razonables, que surjan de su uso del Servicio y de cualquier incumplimiento
              de estos Términos por su parte.
            </p>
          </S>

          <S title="10. Descargo de responsabilidad">
            <p className="uppercase">
              A menos que se indique expresamente aquí, en la medida máxima permitida por la ley,
              ChatVenti no ofrece garantía o representación de ningún tipo con respecto a su Sitio,
              Aplicación, Servicio u otros productos o servicios disponibles, todos los cuales se
              proporcionan &quot;tal cual&quot;. ChatVenti no garantiza la exactitud, integridad,
              vigencia o fiabilidad de los contenidos o datos del Servicio, y renuncia expresamente
              a todas las garantías implícitas, incluidas las de comerciabilidad, calidad
              satisfactoria, idoneidad para un propósito y no infracción. ChatVenti no garantiza que
              el Servicio, su Sitio, Aplicación, servidores o correos estén libres de virus u otros
              componentes dañinos, ni la eficacia del Servicio. Las respuestas generadas por
              inteligencia artificial pueden contener errores; usted es responsable de supervisar su
              uso y configuración (incluido el modo de aprobación). ChatVenti no asume
              responsabilidad por la seguridad, confidencialidad o privacidad de las comunicaciones
              transmitidas a través de internet ni por fallas, retrasos, errores o pérdidas de
              contenido, datos o información, ni por problemas de compatibilidad. El Usuario
              reconoce que es el responsable final del contenido emitido por la IA en su nombre;
              por lo tanto, se obliga a configurar los límites de conocimiento del bot y a
              supervisar periódicamente las interacciones para asegurar el cumplimiento con sus
              políticas internas y la ley.
            </p>
          </S>

          <S title="11. Limitación de responsabilidad">
            <p className="uppercase">
              En la medida máxima permitida por la ley, en ningún caso ChatVenti será responsable de
              (i) (a) ninguna pérdida, reclamo, daño o cualquier daño especial, ejemplar, punitivo,
              indirecto, incidental o consecuente de ningún tipo; o (b) cualquier pérdida de
              ganancias, citas, pedidos, ingresos, ahorros, oportunidades de negocio o datos, ya sea
              con base en contrato, agravio (incluida negligencia), responsabilidad estricta,
              estatuto o de otro modo, que surja de o esté conectada al Acuerdo; y (ii) cualquier
              falla o retraso (incluido el uso o la imposibilidad de usar cualquier componente del
              Servicio, Sitio o Aplicación).
            </p>
            <p>
              Si, a pesar de lo anterior, ChatVenti fuera considerada responsable de cualquier
              pérdida o daño relacionado con el Servicio, su responsabilidad agregada no excederá en
              ningún caso el valor de la suscripción mensual pagada por usted o $1,000.00 MXN, lo
              que sea menor. La responsabilidad de ChatVenti se reducirá en la medida en que usted
              haya contribuido a la pérdida o daño. No excluimos ni limitamos nuestra
              responsabilidad por: (a) muerte o lesiones personales causadas por nuestra
              negligencia; o (b) fraude o tergiversación fraudulenta.
            </p>
          </S>

          <S title="12. Fuerza mayor">
            <p>
              ChatVenti no tiene ninguna responsabilidad y queda liberada de sus obligaciones si el
              cumplimiento de estos Términos se ve afectado por un evento de fuerza mayor. Para
              efectos de esta cláusula, &quot;fuerza mayor&quot; incluye cualquier evento fuera del
              control de ChatVenti o no razonablemente previsible, incluidos desastres naturales,
              incendios, emergencias nacionales, huelgas, la indisponibilidad de internet o la
              interrupción de servicios de terceros de los que depende el Servicio (incluidas las
              plataformas de mensajería como WhatsApp/Meta o Telegram y los proveedores de
              inteligencia artificial).
            </p>
          </S>

          <S title="13. Disposiciones generales">
            <p>
              Si decidimos renunciar a algún derecho en una ocasión particular, esto no nos impide
              ejercerlo en otra ocasión. Si un tribunal determina que alguna parte del Acuerdo es
              inválida o inaplicable, esto no afectará la validez del resto del Acuerdo. Usted no
              puede ceder sus derechos y obligaciones bajo el Acuerdo sin nuestro permiso previo por
              escrito. Estos Términos se rigen e interpretan de acuerdo con las leyes federales de
              los Estados Unidos Mexicanos, y cualquier disputa relacionada estará sujeta a la
              jurisdicción exclusiva de los tribunales competentes en la ciudad de Santiago de
              Querétaro, Querétaro. Si se encuentra fuera de México, es su responsabilidad
              asegurarse de cumplir las leyes locales de su jurisdicción.
            </p>
          </S>

          <S title="Acuerdo de Nivel de Servicio">
            <h3 className="font-semibold text-ink">Garantía de tiempo de actividad mensual</h3>
            <p>
              ChatVenti procura que el Servicio esté disponible el 99.9% del tiempo en un mes
              calendario (&quot;Garantía de Tiempo de Actividad Mensual&quot;), excluyendo el
              Mantenimiento y las Exclusiones (definidos abajo). Usted es elegible para reclamar
              créditos de servicio por el tiempo de inactividad si ChatVenti no cumple la Garantía,
              siempre que ChatVenti verifique un tiempo de inactividad total de al menos 0.1% en un
              mes calendario. El &quot;tiempo de inactividad del servicio&quot; es la imposibilidad
              de acceder al Servicio por falla de la infraestructura administrada por ChatVenti,
              excluyendo el Mantenimiento, las Exclusiones y las plataformas de terceros (mensajería,
              pagos, IA).
            </p>
            <h3 className="font-semibold text-ink">Datos irrecuperables</h3>
            <p>
              Si intenta acceder a sus datos y resultan irrecuperables, repórtelo a ChatVenti lo
              antes posible. ChatVenti investigará la causa con su ayuda. Si la investigación indica
              que la causa es atribuible a ChatVenti, se le otorgará un crédito de servicio de hasta
              un máximo de la tarifa del mes calendario en el que ocurrió el evento.
            </p>
            <h3 className="font-semibold text-ink">Soporte</h3>
            <p>
              ChatVenti proporciona soporte por los canales publicados en el Sitio para las
              suscripciones activas. Las consultas se priorizan según su urgencia; las solicitudes
              de nuevas funciones dependen de la disponibilidad de desarrollo. El soporte no incluye
              capacitación gratuita, aunque puede brindarse según disponibilidad. Proporcione la
              mayor cantidad de información posible en su consulta para una respuesta rápida.
            </p>
            <h3 className="font-semibold text-ink">Exclusiones</h3>
            <p>No habrá derecho a créditos de servicio si el tiempo de inactividad se debe a:</p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                acciones u omisiones suyas o de sus empleados, agentes o contratistas usando sus
                credenciales;
              </li>
              <li>Mantenimiento realizado por ChatVenti;</li>
              <li>
                un ataque de denegación de servicio, actividad de hackers u otro evento malicioso
                dirigido contra ChatVenti o un Usuario;
              </li>
              <li>
                falla de hardware, software, red o infraestructura que no sea propiedad ni esté
                administrada por ChatVenti o sus subcontratistas, incluidas las plataformas de
                WhatsApp/Meta, Telegram y los proveedores de IA o pagos; y
              </li>
              <li>factores fuera del control razonable de ChatVenti.</li>
            </ol>
            <h3 className="font-semibold text-ink">Mantenimiento</h3>
            <p>
              &quot;Mantenimiento&quot; significa: (1) cualquier mantenimiento programado de la
              infraestructura utilizada por ChatVenti, notificado con al menos 2 días de
              anticipación al correo de contacto registrado (manténgalo actualizado); y (2)
              cualquier mantenimiento necesario para evitar una amenaza inmediata a la
              infraestructura o al Servicio, notificado al Usuario.
            </p>
          </S>

          <S title="Cláusula — Complemento de conversaciones IA adicionales">
            <p>
              El módulo de recepcionista IA se contrata por volumen mensual de conversaciones según
              el plan elegido. Si ChatVenti pone a disposición un complemento opcional para
              continuar el servicio de IA al alcanzar el límite mensual de su plan
              (&quot;Conversaciones Adicionales&quot;), aplicará lo siguiente: su activación es
              voluntaria y se realiza desde la configuración de su Cuenta, manifestando su
              consentimiento expreso para los cargos adicionales; cada conversación adicional
              generará el cargo vigente publicado en la página de facturación (más impuestos
              aplicables); los cargos podrán reflejarse en el siguiente ciclo de facturación o en un
              cobro adicional específico según el método de pago registrado; podrá desactivar el
              complemento en cualquier momento con efectos solo hacia futuro; usted es el único
              responsable del control y monitoreo de su uso; y ChatVenti se reserva el derecho de
              modificar el costo o las condiciones del complemento previa notificación conforme a
              estos Términos. Si el complemento no está activo, al alcanzar el límite mensual la IA
              dejará de responder nuevas conversaciones hasta el siguiente ciclo o hasta que
              actualice su plan; sus demás funciones (agenda, chats manuales, reservas web) seguirán
              operando.
            </p>
          </S>
        </div>

        <div className="mt-12 border-t border-line-row pt-6 text-sm text-ink-soft">
          <p>
            ¿Dudas sobre estos términos? Escríbenos a{' '}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-brand-600 hover:underline">
              {LEGAL.contactEmail}
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
