// =====================================================================
// ChatVenti · Landing pública · Copy adaptado a lo REALMENTE desarrollado
//   Precios: derivados del catálogo real (src/features/billing/plans.ts).
//   FAQ: solo capacidades existentes (API oficial Meta, modo aprobación,
//   pausa de IA, anti-solapamiento, portal de facturación, trial 14 días).
// =====================================================================
import {
  ADDON_SEAT_USD,
  ADDON_SEAT_MXN,
  ANNUAL_MONTHS_FREE,
  EXTRA_REPLY_PRICE_USD,
  EXTRA_REPLY_PRICE_MXN,
  TRIAL_DAYS,
  aiRepliesIncluded,
  fmtAmount,
  planById,
  type Currency,
} from '@/features/billing/plans'

export { TRIAL_DAYS }

// ---------------------------------------------------------------------
// El problema (3 tarjetas)
// ---------------------------------------------------------------------
export const PROBLEMS = [
  {
    icon: 'phone-x' as const,
    tint: '#FDECEC',
    title: 'Llamadas y mensajes perdidos',
    body: 'Estás cortando, atendiendo o con las manos ocupadas. El teléfono suena, el WhatsApp se acumula… y esa persona ya reservó en otro lado.',
  },
  {
    icon: 'calendar-x' as const,
    tint: '#FFF4E3',
    title: 'Dobles reservas y agenda en caos',
    body: 'Citas en la libreta, en la cabeza y en tres chats distintos. Dos clientas a la misma hora, huecos vacíos entre citas y disculpas incómodas.',
  },
  {
    icon: 'user-x' as const,
    tint: '#EFEDFB',
    title: 'Clientes que se van a la competencia',
    body: 'Quien escribe para agendar le escribe a varios negocios a la vez, y se queda con el primero que le contesta. Si respondes hasta la noche, ya llegaste tarde.',
  },
]

// ---------------------------------------------------------------------
// Cómo funciona (3 pasos) — sin "QR": la conexión real es con el inicio
// de sesión de Meta (Embedded Signup, API oficial de WhatsApp Business).
// ---------------------------------------------------------------------
export const STEPS = [
  {
    title: 'Conecta tus canales',
    body: 'Vincula el WhatsApp de tu negocio con el inicio de sesión seguro de Meta (API oficial), y activa Telegram y tu página de reservas web si quieres.',
    badge: '⏱ Unos minutos',
    badgeStyle: 'green' as const,
  },
  {
    title: 'Configura tus servicios',
    body: 'Captura servicios, precios, duraciones y horarios de tu equipo desde el panel. La agenda queda lista para ofrecer solo horarios libres.',
    badge: '⏱ Unos minutos',
    badgeStyle: 'green' as const,
  },
  {
    title: 'La IA agenda sola',
    body: 'Activa a tu recepcionista: cada mensaje se contesta al instante y cada cita cae en tu agenda — de día, de noche y en domingo.',
    badge: '✨ Para siempre',
    badgeStyle: 'purple' as const,
  },
]

// ---------------------------------------------------------------------
// Funciones (todas existen en el producto) — sin Google Calendar.
// ---------------------------------------------------------------------
export const FEATURES = [
  {
    icon: 'bulb' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Recepcionista IA',
    body: 'Responde dudas de precios, horarios y servicios con lenguaje natural, acotada a tu negocio y con el tono que tú configures.',
  },
  {
    icon: 'calendar-check' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Agenda inteligente',
    body: 'Solo ofrece horarios realmente libres: respeta duraciones, horarios por miembro del equipo, descansos y ausencias. Adiós dobles reservas.',
  },
  {
    icon: 'chat' as const,
    tint: '#E9F9EF',
    stroke: '#1DA851',
    title: 'WhatsApp, Instagram, Messenger, Telegram y web',
    body: 'Te escriban por donde te escriban, todo cae en la misma agenda y el mismo historial. Instagram y Messenger, incluidos en todos los planes y sin costo por mensaje.',
  },
  {
    icon: 'bell' as const,
    tint: '#E9F9EF',
    stroke: '#1DA851',
    title: 'Recordatorios automáticos',
    body: 'Recordatorio 24 h y 2 h antes de cada cita, y recordatorios recurrentes para invitar a volver ("tu próximo corte", "limpieza cada 6 meses"). Menos inasistencias y más clientes que regresan, sin que muevas un dedo.',
  },
  {
    icon: 'refresh' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Seguimiento post-cita',
    body: 'Después de cada cita, ChatVenti da seguimiento automático e invita a tu cliente a reservar de nuevo. Clientes que regresan solos.',
  },
  {
    icon: 'globe' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Página de reservas con tu marca',
    body: 'Un link elegante con tus servicios y tu tienda para tu bio de Instagram o Google Maps, más un widget para incrustar en tu sitio.',
  },
  {
    icon: 'grid' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Panel de control + CRM',
    body: 'Tu día de un vistazo, y tus clientes ordenados solos: segmentados en Nuevos, Regulares y VIP, con expediente, archivos y quién lleva tiempo sin volver para reactivarlo. Interviene en cualquier chat cuando quieras.',
  },
]

// ---------------------------------------------------------------------
// Industrias (tarjetas de la home).
//   `vertical` enlaza cada tarjeta con su landing /para/<slug> del catálogo
//   único (features/verticales/data.ts). Ojo: NO es 1:1 — "Clínicas estéticas"
//   y "Spas y masajes" son dos ángulos de copy del mismo giro (`spa`), porque
//   `spa_unas` es una sola plantilla de agente. El catálogo manda.
// ---------------------------------------------------------------------
export const INDUSTRIES = [
  {
    vertical: 'barberia',
    emoji: '✂️',
    title: 'Peluquerías y barberías',
    body: 'Agenda por estilista, servicios con duraciones distintas y clientas que reservan a las 11 de la noche sin molestarte.',
    stat: '↑ Más citas fuera de horario',
  },
  {
    vertical: 'dentista',
    emoji: '🦷',
    title: 'Dentistas y clínicas dentales',
    body: 'Primera consulta, limpieza o urgencia: la IA responde, agenda en el horario correcto y el sistema confirma antes de la cita.',
    stat: '↓ Menos inasistencias',
  },
  {
    vertical: 'spa',
    emoji: '✨',
    title: 'Clínicas estéticas',
    body: 'Responde dudas de tratamientos y precios al momento — justo cuando la clienta está decidida — y cierra la cita ahí mismo.',
    stat: '↑ Más consultas de valoración',
  },
  {
    vertical: 'veterinaria',
    emoji: '🐾',
    title: 'Veterinarias',
    body: 'Consultas, vacunas y baño en una sola agenda. La IA pregunta por la mascota, agenda con el veterinario correcto y recuerda la próxima vacuna.',
    stat: '↑ Más consultas recurrentes',
  },
  {
    vertical: 'spa',
    emoji: '💆',
    title: 'Spas y masajes',
    body: 'Cabinas y terapeutas coordinados en una sola agenda, con recordatorios y seguimiento que rellenan los huecos de última hora.',
    stat: '↑ Mayor ocupación de cabinas',
  },
  // Cada giro con landing propia necesita su tarjeta aquí: es el único
  // enlace desde el cuerpo de la home. Sin ella, /para/consultorio-medico
  // solo entraba por el footer.
  {
    vertical: 'consultorio-medico',
    emoji: '🩺',
    title: 'Consultorios médicos',
    body: 'Atiende y agenda consultas 24/7 por WhatsApp, con confirmación automática antes de la cita. Sin dar nunca consejo médico.',
    stat: '↓ Menos ausencias en consulta',
  },
]

// ---------------------------------------------------------------------
// Prueba verificable (sustituye a los testimonios ilustrativos del diseño:
// eran de negocios que no existen). Aquí solo va lo que el visitante puede
// comprobar por sí mismo HOY. Los testimonios vuelven cuando sean reales:
// salen del programa de fundadores.
// ---------------------------------------------------------------------
export const PROOF = [
  {
    icon: 'chat' as const,
    tint: '#E9F9EF',
    stroke: '#1DA851',
    title: 'Pruébala antes de registrarte',
    body: 'El asistente de esta página es la misma IA que atenderá a tus clientes. Escríbele ahora, pregúntale lo que quieras y juzga tú cómo responde.',
  },
  {
    icon: 'calendar-check' as const,
    tint: '#EFEDFB',
    stroke: '#5B4FE0',
    title: 'Conexión oficial con Meta',
    body: 'ChatVenti pasó la revisión de Meta para usar la API oficial de WhatsApp, Instagram y Messenger. Sin aplicaciones piratas ni riesgo de que te bloqueen el número.',
  },
  {
    icon: 'bell' as const,
    tint: '#FFF4E3',
    stroke: '#B8791A',
    title: `${TRIAL_DAYS} días con todo, sin tarjeta`,
    body: 'Usas el producto completo con tus clientes reales antes de pagar. Si no te convence, no hay nada que cancelar: simplemente no te suscribes.',
  },
]

// Programa de negocios fundadores: el origen de los testimonios reales.
// El alta entra con ?ref=fundadores y queda marcada en la organización.
export const FOUNDERS = {
  seats: 20,
  href: '/signup?ref=fundadores',
  title: 'Programa de negocios fundadores',
  lead: 'Buscamos 20 negocios para crecer con ellos. Entras hoy con trato de fundador y, a cambio, nos cuentas con honestidad cómo te fue.',
  gives: [
    'Te lo dejamos funcionando: cargamos tus servicios, horarios y el tono de tu negocio',
    'Tu precio no sube mientras sigas suscrito',
    'Línea directa con el equipo que construye ChatVenti',
  ],
  asks: 'Tu opinión sincera y permiso para contar tu caso con tu nombre.',
  cta: 'Quiero ser negocio fundador',
}

// ---------------------------------------------------------------------
// Precios — derivados del catálogo REAL de billing (USD, trial 14 días).
//   Catálogo 2026-08: Arranque $19 · Negocio $39 (popular) · Profesional $79
//   · Multi-sede $149. WhatsApp con IA en TODOS — es la promesa de la home.
// ---------------------------------------------------------------------
const ARRANQUE = planById('arranque')
const NEGOCIO = planById('negocio')
const PROFESIONAL = planById('profesional')
const MULTISEDE = planById('multisede')

export const PRICING = {
  starter: {
    name: `${ARRANQUE.name} · Para quien trabaja solo`,
    desc: ARRANQUE.tagline,
    plan: ARRANQUE.id,
    items: ARRANQUE.features,
    cta: 'Empezar prueba gratis',
  },
  popular: {
    name: `${NEGOCIO.name} · Para equipos pequeños`,
    desc: NEGOCIO.tagline,
    plan: NEGOCIO.id,
    items: [
      'Todo lo del plan Arranque',
      `Hasta ${NEGOCIO.maxResources} profesionales · ${NEGOCIO.maxSeats} accesos`,
      'Superpoderes: lee comprobantes y escucha notas de voz',
      'Rescata interesados que no cerraron cita',
      'Resumen diario de tu negocio',
    ],
    cta: `Probar gratis ${TRIAL_DAYS} días`,
    badge: 'EL MÁS ELEGIDO',
    foot: 'Cancela cuando quieras, desde tu panel',
  },
  volume: {
    name: `${PROFESIONAL.name} · Clínicas y estéticas`,
    desc: PROFESIONAL.tagline,
    plan: PROFESIONAL.id,
    items: [
      'Todo lo del plan Negocio',
      `Hasta ${PROFESIONAL.maxResources} profesionales · ${PROFESIONAL.maxSeats} accesos`,
      'Expediente del cliente con archivos y recordatorios',
      'El doble de uso de IA incluido que en Negocio',
    ],
    cta: 'Empezar prueba gratis',
  },
  multisede: {
    name: `${MULTISEDE.name} · Equipos grandes`,
    desc: MULTISEDE.tagline,
    plan: MULTISEDE.id,
    items: [
      'Todo lo del plan Profesional',
      `Profesionales ilimitados · ${MULTISEDE.maxSeats} accesos`,
      'El mayor uso de IA incluido y soporte prioritario',
      'Varias sucursales en una cuenta: próximamente',
    ],
    cta: 'Empezar prueba gratis',
  },
  annual: `Paga el año completo y te regalamos ${ANNUAL_MONTHS_FREE} meses: 12 por el precio de 10.`,
}

/** Letra pequeña de precios en la moneda de quien visita. */
export function pricingFootnote(currency: Currency): string {
  const seat = currency === 'mxn' ? `+${fmtAmount(ADDON_SEAT_MXN)} MXN/mes más IVA` : `+$${ADDON_SEAT_USD} USD/mes`
  const cur = currency === 'mxn' ? 'Precios en pesos mexicanos, más IVA' : 'Precios en dólares (USD)'
  return `Acceso de equipo adicional: ${seat}. ${cur} · ${TRIAL_DAYS} días de prueba gratis en todos los planes · cambia o cancela cuando quieras.`
}

// ---------------------------------------------------------------------
// FAQ — sincronizado con las capacidades reales (también alimenta el
// JSON-LD FAQPage de la página).
// ---------------------------------------------------------------------
export const FAQS = [
  {
    q: '¿Necesito saber programar para usar ChatVenti?',
    a: 'No. Creas tu cuenta, conectas tu WhatsApp con el inicio de sesión seguro de Meta, capturas tus servicios y horarios en el panel y activas la IA. Todo desde el navegador, sin instalar nada.',
  },
  {
    q: '¿Cómo se conecta ChatVenti a WhatsApp?',
    a: 'Con la API oficial de WhatsApp Business (Meta), la misma tecnología que usan las grandes marcas. Nada de aplicaciones no oficiales ni celulares que deban quedarse prendidos: conectas la cuenta de WhatsApp Business de tu negocio desde el panel. También puedes activar Telegram y tu página de reservas web.',
  },
  {
    q: '¿Qué pasa si la IA no sabe responder algo?',
    a: 'La IA está acotada a tu negocio: si algo se sale de lo configurado, escala la conversación a una persona y te avisa. Además puedes activar el modo aprobación, donde la IA te propone la respuesta y tú la apruebas con un botón antes de que se envíe.',
  },
  {
    q: '¿Puedo intervenir en una conversación cuando quiera?',
    a: 'Sí. Desde el panel ves todas las conversaciones y puedes tomar el control en cualquier momento. Cuando tú intervienes, la IA se pausa automáticamente para no interrumpirte, y la reactivas cuando termines.',
  },
  {
    q: '¿Cómo evita ChatVenti las dobles reservas?',
    a: 'La agenda solo ofrece horarios realmente libres: respeta la duración de cada servicio, los horarios de tu negocio y de cada miembro del equipo, descansos y ausencias, y bloquea automáticamente cualquier solapamiento.',
  },
  {
    q: '¿En qué se diferencian los cuatro planes?',
    a: 'La recepcionista con IA por WhatsApp, web y Telegram va en los cuatro. Cambia el tamaño de tu equipo (cuántos profesionales agendan y cuántas personas entran al panel), las funciones avanzadas y cuánto uso de IA trae incluido cada mes. Si tu negocio crece, cambias de plan desde tu panel cuando quieras.',
  },
  {
    q: '¿Cuánto cuestan los mensajes de WhatsApp, Instagram y Messenger?',
    a: 'Instagram y Messenger no tienen costo por mensaje: Meta no los cobra y vienen incluidos en todos los planes. WhatsApp sí lo cobra Meta, directo a la cuenta de WhatsApp de tu negocio y sin intermediarios: cada número tiene 1,000 mensajes de servicio gratis al mes (las respuestas a quien te escribe), así que a un negocio pequeño puede no costarle nada. Los recordatorios automáticos sí los cobra Meta, por mensaje y según tu país. Tu tarjeta la pones en Meta, no en ChatVenti.',
  },
  {
    q: '¿Qué necesito para conectar mi WhatsApp?',
    a: 'Una cuenta de Facebook (o una cuenta de Meta para empresas), un número que pueda recibir un SMS o una llamada para verificarlo y que no esté activo en la app de WhatsApp, y el nombre que verán tus clientes. Lo conectas desde tu panel en Conexiones, en unos minutos. Mientras tanto puedes atender por Instagram, Messenger, Telegram y tu página de reservas.',
  },
  {
    q: '¿Qué pasa si mi recepcionista atiende más de lo que incluye mi plan?',
    a: `Nunca se detiene. El plan Arranque incluye ${aiRepliesIncluded('arranque').toLocaleString('en-US')} respuestas de IA al mes y el plan Negocio ${aiRepliesIncluded('negocio').toLocaleString('en-US')}: mucho más de lo que usa un negocio normal. Si un mes lo rebasas, cada 1,000 respuestas adicionales cuestan ${fmtAmount(Number((EXTRA_REPLY_PRICE_MXN * 1000).toFixed(2)))} MXN más IVA en México (o $${(EXTRA_REPLY_PRICE_USD * 1000).toFixed(2)} USD fuera de México) y se suman a tu siguiente factura. Tu consumo lo ves en tiempo real en tu panel.`,
  },
  {
    q: '¿Hay descuento si pago el año completo?',
    a: `Sí: pagas 10 meses y usas 12. Eliges pago mensual o anual al activar tu plan, después de tus ${TRIAL_DAYS} días de prueba.`,
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: `Sí. No hay contratos forzosos ni penalizaciones: administras tu suscripción, cambias de plan o cancelas desde el portal de facturación de tu panel. Y empiezas con ${TRIAL_DAYS} días de prueba gratis, sin tarjeta de crédito.`,
  },
  {
    q: '¿Cuánto tarda la configuración?',
    a: 'Unos minutos: conectas tu canal, capturas servicios, precios y horarios, y activas a tu recepcionista. Si necesitas ayuda, te acompañamos por correo en soporte@chatventi.com.',
  },
]
