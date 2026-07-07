// =====================================================================
// ChatVenti · Landing pública · Copy adaptado a lo REALMENTE desarrollado
//   Precios: derivados del catálogo real (src/features/billing/plans.ts).
//   FAQ: solo capacidades existentes (API oficial Meta, modo aprobación,
//   pausa de IA, anti-solapamiento, portal de facturación, trial 14 días).
// =====================================================================
import {
  STARTER_PRICE_USD,
  ADDON_DOMAIN_USD,
  ADDON_TEAM_USD,
  TRIAL_DAYS,
  aiTierById,
  monthlyTotalUsd,
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
    body: '6 de cada 10 personas agendan con el primer negocio que les responde. Si contestas hasta la noche, ya llegaste tarde.',
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
    title: 'Omnicanal: WhatsApp, Telegram y web',
    body: 'Te escriban por donde te escriban, todo cae en la misma agenda y el mismo historial. Un solo lugar, cero chats perdidos.',
  },
  {
    icon: 'bell' as const,
    tint: '#E9F9EF',
    stroke: '#1DA851',
    title: 'Recordatorios automáticos',
    body: 'Recordatorio 24 horas y 2 horas antes de cada cita, por el canal del cliente. Menos inasistencias sin que tú mandes un solo mensaje.',
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
    body: 'Tu día de un vistazo: citas, conversaciones y tus clientes con etiquetas, notas e historial. Interviene en cualquier chat cuando quieras.',
  },
]

// ---------------------------------------------------------------------
// Industrias
// ---------------------------------------------------------------------
export const INDUSTRIES = [
  {
    emoji: '✂️',
    title: 'Peluquerías y barberías',
    body: 'Agenda por estilista, servicios con duraciones distintas y clientas que reservan a las 11 de la noche sin molestarte.',
    stat: '↑ Más citas fuera de horario',
  },
  {
    emoji: '🦷',
    title: 'Dentistas y consultorios',
    body: 'Primera consulta, limpieza o urgencia: la IA responde, agenda en el horario correcto y el sistema confirma antes de la cita.',
    stat: '↓ Menos inasistencias',
  },
  {
    emoji: '✨',
    title: 'Clínicas estéticas',
    body: 'Responde dudas de tratamientos y precios al momento — justo cuando la clienta está decidida — y cierra la cita ahí mismo.',
    stat: '↑ Más consultas de valoración',
  },
  {
    emoji: '💆',
    title: 'Spas y masajes',
    body: 'Cabinas y terapeutas coordinados en una sola agenda, con recordatorios y seguimiento que rellenan los huecos de última hora.',
    stat: '↑ Mayor ocupación de cabinas',
  },
]

// ---------------------------------------------------------------------
// Testimonios (ilustrativos, del diseño)
// ---------------------------------------------------------------------
export const TESTIMONIALS = [
  {
    quote:
      '“Antes perdía clientas porque contestaba el WhatsApp hasta la noche. Ahora la IA las agenda al momento. Pasé de 80 a 130 citas al mes sin contratar a nadie.”',
    initials: 'MG',
    bg: '#C7BFF5',
    fg: '#3E33B5',
    name: 'Marcela García',
    role: 'Estética Marcela · CDMX',
    chip: '+62% citas',
  },
  {
    quote:
      '“Los recordatorios automáticos cambiaron todo. Teníamos 8 o 10 pacientes que no llegaban cada semana; hoy son 2 o 3. Se paga solo con la primera semana.”',
    initials: 'RA',
    bg: '#B7E8CB',
    fg: '#128C4A',
    name: 'Dr. Ricardo Aguilar',
    role: 'Dental Aguilar · Guadalajara',
    chip: '−70% ausencias',
  },
  {
    quote:
      '“Somos 4 barberos y era un desorden de chats. Ahora cada quien ve su agenda y no ha vuelto a haber una sola doble reserva. Lo configuré yo solo un domingo.”',
    initials: 'LP',
    bg: '#F5D9BF',
    fg: '#A05B1F',
    name: 'Luis Peña',
    role: 'Barbería La Norteña · Monterrey',
    chip: '0 dobles reservas',
  },
]

// ---------------------------------------------------------------------
// Precios — derivados del catálogo REAL de billing (USD, trial 14 días).
//   Starter $29 · IA ~300 +$19 · ~1.000 +$39 (popular) · ~3.000 +$109.
// ---------------------------------------------------------------------
const TIER_1000 = aiTierById('1000')
const TIER_3000 = aiTierById('3000')
const TIER_300 = aiTierById('300')

export const PRICING = {
  starter: {
    name: 'Starter · Solo agenda',
    desc: 'La base completa para ordenar tu negocio. Tú respondes los chats.',
    price: STARTER_PRICE_USD,
    items: [
      'Agenda inteligente sin dobles reservas',
      'Página de reservas web con tu marca + widget',
      'CRM: clientes, etiquetas, notas e historial',
      'Recordatorios de cita automáticos (24 h y 2 h)',
      '2 cuentas de equipo incluidas',
    ],
    cta: 'Empezar prueba gratis',
  },
  popular: {
    name: 'Starter + Recepcionista IA',
    desc: `La IA responde y agenda por ti. ${TIER_1000.detail}.`,
    price: monthlyTotalUsd({ aiTier: '1000' }),
    items: [
      'Todo lo del plan Starter',
      'Recepcionista IA en WhatsApp, Telegram y web',
      'Agenda citas sola, 24/7, con lenguaje natural',
      'Escala a humano y modo aprobación con un botón',
      'Se pausa cuando tú intervienes en el chat',
    ],
    cta: `Probar gratis ${TRIAL_DAYS} días`,
    badge: 'EL MÁS ELEGIDO',
    foot: 'Cancela cuando quieras, desde tu panel',
  },
  volume: {
    name: 'IA · Volumen alto',
    desc: `Para negocios con mucho chat. ${TIER_3000.detail}.`,
    price: monthlyTotalUsd({ aiTier: '3000' }),
    items: [
      'Todo lo de Starter + Recepcionista IA',
      `${TIER_3000.detail} atendidas por la IA`,
      'Ideal para clínicas y equipos con alto volumen',
      'Add-ons disponibles: dominio y cuentas extra',
    ],
    cta: 'Empezar prueba gratis',
  },
  footnote: `¿Poco volumen? Activa la IA con ${TIER_300.detail} por solo +$${TIER_300.priceUsd} (total $${monthlyTotalUsd({ aiTier: '300' })}/mes). Add-ons: dominio propio +$${ADDON_DOMAIN_USD}/mes · cuenta de empleado extra +$${ADDON_TEAM_USD}/mes. Precios en USD · ${TRIAL_DAYS} días de prueba gratis en todos los planes · cambia o cancela cuando quieras.`,
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
    q: '¿Qué cuenta como “conversación” en los planes de IA?',
    a: 'Es el volumen mensual aproximado de conversaciones que atiende la IA: ~300, ~1.000 o ~3.000 según el nivel que elijas. Si tu negocio crece, subes de nivel desde tu panel cuando quieras.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: `Sí. No hay contratos forzosos ni penalizaciones: administras tu suscripción, cambias de plan o cancelas desde el portal de facturación de tu panel. Y empiezas con ${TRIAL_DAYS} días de prueba gratis.`,
  },
  {
    q: '¿Cuánto tarda la configuración?',
    a: 'Unos minutos: conectas tu canal, capturas servicios, precios y horarios, y activas a tu recepcionista. Si necesitas ayuda, te acompañamos por correo en soporte@chatventi.com.',
  },
]
