// =====================================================================
// ChatVenti · Copy por vertical para las landings /para/[giro]
//
//   Se separa de data.ts a propósito: data.ts es la taxonomía (la usan el
//   sitemap, el registro y el copy del quiz) y debe seguir siendo barata de
//   importar desde cualquier sitio. Esto es solo texto de marketing.
//
//   Las FAQ son PROPIAS de cada giro y alimentan su JSON-LD FAQPage. No se
//   reutilizan las FAQS genéricas de la home: cinco páginas con las mismas
//   preguntas son contenido duplicado y Google las trata como tal.
// =====================================================================

export type VerticalContent = {
  /** H1 de la página. Debe contener el término que la gente busca. */
  h1: string
  /** Frase de apoyo bajo el H1. */
  subtitle: string
  /** Alt de la foto del hero. La ruta se deriva del slug: /verticales/<slug>.webp */
  imageAlt: string
  /** <title> y meta description. Cortos: Google trunca ~60 / ~155. */
  metaTitle: string
  metaDescription: string
  /** Los 3 dolores concretos del giro. */
  pains: { title: string; body: string }[]
  /** Lo que hace ChatVenti dicho en el vocabulario del giro. */
  benefits: { title: string; body: string }[]
  /** FAQ propias del giro → JSON-LD FAQPage. */
  faqs: { q: string; a: string }[]
}

export const VERTICAL_CONTENT: Record<string, VerticalContent> = {
  barberia: {
    h1: 'Tu recepcionista con IA para barberías y peluquerías',
    subtitle:
      'Contesta y agenda por WhatsApp mientras tienes las tijeras en la mano. Cada barbero con su propia agenda, sin dobles reservas.',
    imageAlt: 'Barbero atendiendo a un cliente en una barbería luminosa',
    metaTitle: 'Agenda con IA para barberías y peluquerías · ChatVenti',
    metaDescription:
      'Software de citas para barberías y peluquerías: la IA contesta WhatsApp, agenda por barbero y manda recordatorios. Sin dobles reservas. Prueba gratis.',
    pains: [
      {
        title: 'El teléfono suena mientras cortas',
        body: 'No puedes soltar la máquina a media patilla. Para cuando contestas, esa persona ya reservó en la barbería de enfrente.',
      },
      {
        title: 'Cada barbero lleva su propia libreta',
        body: 'Uno apunta en el celular, otro en la agenda de papel, otro se acuerda. Al final acaban dos clientes en la silla a la misma hora.',
      },
      {
        title: 'Los clientes se olvidan y la silla queda vacía',
        body: 'Un hueco de las 5 de la tarde un sábado es dinero que ya no vuelve. Y llamar uno por uno para confirmar no lo hace nadie.',
      },
    ],
    benefits: [
      {
        title: 'Agenda por barbero, no por local',
        body: 'Cada barbero tiene su horario, sus servicios y sus descansos. El cliente elige con quién quiere cortarse — o deja que le toque el primero libre.',
      },
      {
        title: 'Duraciones reales de cada servicio',
        body: 'Corte 30 min, corte con barba 45, diseño 1 h. La IA solo ofrece huecos donde el servicio cabe de verdad.',
      },
      {
        title: 'Recordatorio y regreso automáticos',
        body: 'Aviso 24 h y 2 h antes de la cita, y un mensaje a las cuatro semanas para invitarle al siguiente corte. Sin que muevas un dedo.',
      },
    ],
    faqs: [
      {
        q: '¿Puede cada barbero tener su propia agenda?',
        a: 'Sí. Das de alta a cada barbero con su horario, sus días libres y los servicios que hace. El cliente puede elegir con quién quiere cortarse o pedir el primer hueco disponible con cualquiera, y la IA respeta la agenda individual de cada uno.',
      },
      {
        q: '¿Qué pasa si dos clientes piden la misma hora?',
        a: 'No puede ocurrir. La agenda solo ofrece huecos realmente libres: cruza el horario de la barbería, el del barbero, la duración del servicio y las citas ya tomadas. En cuanto una hora se reserva, desaparece de las opciones.',
      },
      {
        q: '¿Necesito un número de WhatsApp nuevo?',
        a: 'No. Se conecta el WhatsApp Business que ya usa tu barbería, con el inicio de sesión oficial de Meta. Tus clientes te siguen escribiendo al mismo número de siempre.',
      },
      {
        q: '¿Puedo contestar yo cuando quiera?',
        a: 'Sí, en cualquier momento. Entras a la conversación desde el panel y la IA se pausa sola para no pisarte. Cuando terminas, la reactivas con un botón.',
      },
    ],
  },

  dentista: {
    h1: 'Tu recepcionista con IA para clínicas dentales',
    subtitle:
      'Atiende cada mensaje, agenda por tipo de tratamiento y confirma antes de la cita. Menos huecos vacíos en el sillón.',
    imageAlt: 'Dentista junto al sillón de una clínica dental moderna',
    metaTitle: 'Agenda con IA para clínicas dentales y dentistas · ChatVenti',
    metaDescription:
      'Software de citas para clínicas dentales: la IA contesta WhatsApp, agenda por tratamiento y confirma para reducir ausencias. Prueba gratis, sin tarjeta.',
    pains: [
      {
        title: 'Las ausencias te vacían la agenda',
        body: 'Un paciente que no llega a una endodoncia de una hora es una hora que no se recupera. Y confirmar a mano cuesta media mañana de recepción.',
      },
      {
        title: 'Las urgencias entran por WhatsApp a cualquier hora',
        body: 'Un dolor a las 10 de la noche escribe igual. Si nadie contesta hasta mañana, ese paciente acaba en otra clínica.',
      },
      {
        title: 'Cada tratamiento dura algo distinto',
        body: 'Una limpieza no ocupa lo mismo que un blanqueamiento o una extracción. Encajarlos a ojo deja huecos muertos entre paciente y paciente.',
      },
    ],
    benefits: [
      {
        title: 'Agenda por tratamiento y por especialista',
        body: 'Cada tratamiento con su duración real y cada dentista con su horario. La IA propone solo huecos donde el tratamiento entra completo.',
      },
      {
        title: 'Confirmación automática antes de la cita',
        body: 'Recordatorio 24 h y 2 h antes por WhatsApp. El paciente confirma o reagenda solo, sin que recepción levante el teléfono.',
      },
      {
        title: 'Nunca da consejo clínico',
        body: 'La recepcionista IA resuelve horarios, precios y requisitos, pero cualquier tema clínico lo deriva a una valoración con el dentista. Está configurada así de fábrica.',
      },
    ],
    faqs: [
      {
        q: '¿La IA da diagnósticos o consejos médicos a los pacientes?',
        a: 'No, y no es opcional: la plantilla dental viene con la instrucción de no dar diagnósticos ni indicaciones clínicas. Ante cualquier duda de salud ofrece agendar una valoración con el dentista. Responde solo temas administrativos: horarios, precios, ubicación y qué traer.',
      },
      {
        q: '¿Cómo reduce las ausencias?',
        a: 'Con recordatorios automáticos 24 horas y 2 horas antes por WhatsApp, y un enlace donde el paciente puede confirmar o reagendar él mismo. Reagendar es mucho mejor que un hueco vacío: la hora vuelve a quedar libre para otro paciente.',
      },
      {
        q: '¿Puedo tener distintas duraciones por tratamiento?',
        a: 'Sí. Cada tratamiento se configura con su duración real —limpieza, valoración, blanqueamiento, endodoncia— y la agenda solo ofrece huecos donde ese tratamiento cabe completo, sin dejar espacios muertos.',
      },
      {
        q: '¿Los datos de mis pacientes están seguros?',
        a: 'Sí. Cada clínica ve únicamente sus propios datos, con aislamiento aplicado en la base de datos. Nadie de otra clínica puede acceder a tu información, y puedes exportar o eliminar tus datos cuando quieras.',
      },
    ],
  },

  veterinaria: {
    h1: 'Tu recepcionista con IA para clínicas veterinarias',
    subtitle:
      'Consultas, vacunas y baño en una sola agenda. La IA pregunta por la mascota, agenda con el veterinario correcto y recuerda la próxima vacuna.',
    imageAlt: 'Veterinaria revisando a un perro acompañada de su dueña',
    metaTitle: 'Agenda con IA para clínicas veterinarias · ChatVenti',
    metaDescription:
      'Software de citas para veterinarias: la IA contesta WhatsApp, agenda consultas, vacunas y estética, y recuerda la próxima visita. Prueba gratis.',
    pains: [
      {
        title: 'Estás en consulta y el WhatsApp no para',
        body: 'Con un perro en la mesa no puedes contestar. Los mensajes se acumulan y el dueño que buscaba cita hoy llama a la clínica de la otra cuadra.',
      },
      {
        title: 'Consulta, vacuna y baño no son lo mismo',
        body: 'Una estética ocupa dos horas y una vacuna diez minutos. Mezclarlos a ojo en la misma agenda te deja el día roto.',
      },
      {
        title: 'Las vacunas y desparasitaciones se olvidan',
        body: 'Nadie se acuerda de que la vacuna toca en seis meses. Y esa visita recurrente es la que sostiene la clínica.',
      },
    ],
    benefits: [
      {
        title: 'Pregunta por la mascota, no solo por el dueño',
        body: 'La IA pide el nombre y la especie, y lo deja en el expediente. Cuando el dueño vuelve a escribir, ya sabe de quién le habla.',
      },
      {
        title: 'Cada servicio en su hueco correcto',
        body: 'Consulta, vacunación, cirugía o baño y estética, cada uno con su duración y su profesional. Sin cirugías encajadas entre dos baños.',
      },
      {
        title: 'Recordatorios recurrentes de vacuna',
        body: 'Programas el aviso a los 6 o 12 meses y ChatVenti escribe solo al dueño cuando toca. La visita recurrente deja de depender de que se acuerden.',
      },
    ],
    faqs: [
      {
        q: '¿La IA registra los datos de la mascota?',
        a: 'Sí. Cuando es útil pregunta el nombre y la especie de la mascota y lo guarda en el expediente del cliente, junto con el historial de visitas. En la siguiente conversación ya tiene ese contexto.',
      },
      {
        q: '¿Puede avisar cuando toca la próxima vacuna?',
        a: 'Sí. Puedes programar recordatorios recurrentes —por ejemplo a los 6 o 12 meses— y ChatVenti escribe al dueño por WhatsApp cuando llega la fecha, invitándole a agendar. Es una de las funciones que más citas recupera.',
      },
      {
        q: '¿Da diagnósticos sobre la mascota?',
        a: 'No. La plantilla de veterinaria viene configurada para no dar diagnósticos ni indicaciones clínicas: ante cualquier síntoma ofrece agendar una consulta con el veterinario. Responde horarios, precios, servicios y qué traer a la cita.',
      },
      {
        q: '¿Sirve si tengo varios veterinarios y una sala de estética?',
        a: 'Sí. Cada veterinario y cada recurso —consultorio, sala de estética— se configura por separado, con su horario y los servicios que presta. La agenda cruza todo y solo ofrece huecos donde el servicio realmente cabe.',
      },
    ],
  },

  spa: {
    h1: 'Tu recepcionista con IA para spas y estudios de uñas',
    subtitle:
      'Agenda tratamientos largos sin romper el día, coordina cabinas y terapeutas, y recupera los huecos de última hora.',
    imageAlt: 'Sala de spa con camilla preparada, velas y plantas',
    metaTitle: 'Agenda con IA para spas, uñas y estética · ChatVenti',
    metaDescription:
      'Software de citas para spas y estudios de uñas: la IA contesta WhatsApp, coordina cabinas y terapeutas, y manda recordatorios. Prueba gratis.',
    pains: [
      {
        title: 'Los tratamientos largos no admiten error',
        body: 'Una cancelación de última hora en un tratamiento de dos horas es media tarde perdida, y no da tiempo a rellenarla llamando.',
      },
      {
        title: 'Cabina y terapeuta tienen que cuadrar a la vez',
        body: 'Puede haber terapeuta libre y ninguna cabina, o al revés. Cuadrarlo de cabeza, con el teléfono en la mano, es donde salen los errores.',
      },
      {
        title: 'Las clientas escriben por la noche',
        body: 'El momento en que se deciden a reservar un masaje son las 11 de la noche. Si contestas al día siguiente, ya se les pasó.',
      },
    ],
    benefits: [
      {
        title: 'Cabinas y terapeutas en una sola agenda',
        body: 'Configura cada cabina y cada terapeuta como recurso con su horario. La IA solo ofrece huecos donde ambos coinciden libres.',
      },
      {
        title: 'Tratamientos con su duración real',
        body: 'Un ritual de 90 minutos ocupa 90 minutos. Nada de citas encajadas que arrastran retrasos toda la tarde.',
      },
      {
        title: 'Recordatorios que salvan la agenda',
        body: 'Aviso 24 h y 2 h antes, con opción de reagendar en un clic. Mejor mover una cita con tiempo que descubrir el hueco cuando ya es tarde.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo gestionar cabinas y terapeutas por separado?',
        a: 'Sí. Cada cabina y cada terapeuta se da de alta como un recurso independiente, con su propio horario y los servicios que admite. La agenda cruza ambos y solo ofrece un hueco cuando la cabina y la persona están libres a la vez.',
      },
      {
        q: '¿Cómo maneja los tratamientos de larga duración?',
        a: 'Cada servicio lleva su duración real configurada. Si un ritual dura 90 minutos, la IA solo ofrece huecos de 90 minutos libres y bloquea ese tiempo completo, sin solapamientos ni retrasos en cadena.',
      },
      {
        q: '¿Puede vender paquetes o bonos?',
        a: 'La IA informa de precios y de lo que incluye cada paquete a partir de la información que cargues, y agenda la cita. El cobro del paquete se hace como lo hagas hoy: ChatVenti gestiona la conversación y la agenda, no el pago del tratamiento.',
      },
      {
        q: '¿Contesta también por Instagram?',
        a: 'Hoy responde en WhatsApp, Telegram y en tu página de reservas web. Puedes poner el enlace de reservas en la bio de Instagram para que quien te escriba por ahí agende en un clic.',
      },
    ],
  },

  'consultorio-medico': {
    h1: 'Tu recepcionista con IA para consultorios médicos',
    subtitle:
      'Atiende y agenda consultas 24/7 por WhatsApp, con confirmación automática. Sin dar nunca consejo médico.',
    imageAlt: 'Médico conversando con una paciente en su consultorio',
    metaTitle: 'Agenda con IA para consultorios médicos · ChatVenti',
    metaDescription:
      'Software de citas para consultorios médicos: la IA contesta WhatsApp, agenda consultas y confirma antes de la cita. Nunca da consejo clínico. Prueba gratis.',
    pains: [
      {
        title: 'La consulta y el teléfono compiten',
        body: 'Con un paciente delante no se contesta el teléfono. Y quien llama para pedir cita rara vez vuelve a llamar dos veces.',
      },
      {
        title: 'Recepción se va en confirmar citas',
        body: 'Media jornada llamando uno por uno para recordar la consulta del día siguiente es trabajo que puede hacerse solo.',
      },
      {
        title: 'Las ausencias dejan huecos que no se rellenan',
        body: 'Un paciente que no avisa deja un espacio muerto en la agenda que ya no se ocupa con nadie.',
      },
    ],
    benefits: [
      {
        title: 'Agenda 24/7 sin ocupar a recepción',
        body: 'Los pacientes agendan, reagendan y cancelan por WhatsApp a cualquier hora. Recepción se dedica a quien está en la sala.',
      },
      {
        title: 'Confirmación y reagenda automáticas',
        body: 'Recordatorio 24 h y 2 h antes, con enlace para mover la cita. Reagendar libera la hora para otro paciente.',
      },
      {
        title: 'Límite clínico estricto',
        body: 'La IA no da diagnósticos, indicaciones ni consejos médicos: cualquier tema clínico se deriva a consulta. Viene así configurada y no depende de cómo escriba el paciente.',
      },
    ],
    faqs: [
      {
        q: '¿La IA puede dar indicaciones médicas a un paciente?',
        a: 'No. La plantilla de consultorio médico viene con la instrucción explícita de no dar diagnósticos, indicaciones ni consejos clínicos. Ante cualquier tema de salud ofrece agendar una consulta con el profesional. Solo resuelve temas administrativos: horarios, ubicación, precios y requisitos.',
      },
      {
        q: '¿Puedo revisar lo que responde antes de que se envíe?',
        a: 'Sí. Existe el modo aprobación: la IA prepara la respuesta y no se envía hasta que tú la apruebas con un botón. Es lo más recomendable durante las primeras semanas, hasta que tengas confianza en cómo responde.',
      },
      {
        q: '¿Qué pasa con los datos de los pacientes?',
        a: 'Cada consultorio ve solo sus propios datos, con aislamiento aplicado en la base de datos. Puedes exportar o eliminar la información cuando quieras. Los mensajes viajan por la API oficial de WhatsApp Business de Meta, no por aplicaciones no oficiales.',
      },
      {
        q: '¿Puedo probarlo antes de que hable con un paciente real?',
        a: 'Sí, y es lo que recomendamos. Hay un espacio de pruebas dentro del panel donde conversas con tu propia recepcionista IA usando la información real de tu consultorio, pero sin crear citas ni enviar nada a nadie.',
      },
    ],
  },
}

export function verticalContent(slug: string): VerticalContent | null {
  return VERTICAL_CONTENT[slug] ?? null
}
