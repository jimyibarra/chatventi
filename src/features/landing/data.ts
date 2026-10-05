// =====================================================================
// ChatVenti · Landing pública · Copy adaptado a lo REALMENTE desarrollado
//   Precios: derivados del catálogo real (src/features/billing/plans.ts).
//   FAQ: solo capacidades existentes (API oficial Meta, modo aprobación,
//   pausa de IA, anti-solapamiento, portal de facturación, trial 14 días).
// =====================================================================
import {
  EXTRA_REPLY_PRICE_USD,
  EXTRA_REPLY_PRICE_MXN,
  PLANS,
  TRIAL_DAYS,
  aiRepliesIncluded,
  fmtAmount,
  planById,
  type PlanId,
} from '@/features/billing/plans'
import type { Fare } from './fares'

export { TRIAL_DAYS }

// ---------------------------------------------------------------------
// Funciones (todas existen en el producto) — sin Google Calendar.
// ---------------------------------------------------------------------
export const FEATURES = [
  {
    title: 'Recepcionista IA',
    body: 'Responde dudas de precios, horarios y servicios con lenguaje natural, acotada a tu negocio y con el tono que tú configures.',
  },
  {
    title: 'Agenda inteligente',
    body: 'Solo ofrece horarios realmente libres: respeta duraciones, horarios por miembro del equipo, descansos y ausencias. Adiós dobles reservas.',
  },
  {
    title: 'WhatsApp, Instagram, Messenger, Telegram y web',
    body: 'Te escriban por donde te escriban, todo cae en la misma agenda y el mismo historial. Instagram y Messenger, incluidos en todos los planes y sin costo por mensaje.',
  },
  {
    title: 'Recordatorios automáticos',
    body: 'Recordatorio 24 h y 2 h antes de cada cita, y recordatorios recurrentes para invitar a volver ("tu próximo corte", "limpieza cada 6 meses"). Menos inasistencias y más clientes que regresan, sin que muevas un dedo.',
  },
  {
    title: 'Seguimiento post-cita',
    body: 'Después de cada cita, ChatVenti da seguimiento automático e invita a tu cliente a reservar de nuevo. Clientes que regresan solos.',
  },
  {
    title: 'Página de reservas con tu marca',
    body: 'Un link elegante con tus servicios y tu tienda para tu bio de Instagram o Google Maps, más un widget para incrustar en tu sitio.',
  },
  {
    title: 'Panel de control + CRM',
    body: 'Tu día de un vistazo, y tus clientes ordenados solos: segmentados en Nuevos, Regulares y VIP, con expediente, archivos y quién lleva tiempo sin volver para reactivarlo. Interviene en cualquier chat cuando quieras.',
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
    title: 'Pruébala antes de registrarte',
    body: 'El asistente de esta página es la misma IA que atenderá a tus clientes. Escríbele ahora, pregúntale lo que quieras y juzga tú cómo responde.',
  },
  {
    title: 'Conexión oficial con Meta',
    body: 'ChatVenti pasó la revisión de Meta para usar la API oficial de WhatsApp, Instagram y Messenger. Sin aplicaciones piratas ni riesgo de que te bloqueen el número.',
  },
  {
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
// Precios — derivados del catálogo REAL de billing (plans.ts).
// ---------------------------------------------------------------------
const ARRANQUE = planById('arranque')
const NEGOCIO = planById('negocio')
const PROFESIONAL = planById('profesional')
const MULTISEDE = planById('multisede')

// Tarifa de la home («Líneas»): tres renglones por plan, lo que más distingue a
// cada uno. Nombre, precios y frase salen del catálogo; el color es su línea.
const FARE_COPY: Record<PlanId, { color: string; items: string[] }> = {
  arranque: {
    color: '#0b5bd3',
    items: ['Recepcionista IA en todos los canales', 'Agenda, reservas web y recordatorios', `${ARRANQUE.maxResources} profesional · ${ARRANQUE.maxSeats} acceso`],
  },
  negocio: {
    color: '#5b4fe0',
    items: [`Hasta ${NEGOCIO.maxResources} profesionales · ${NEGOCIO.maxSeats} accesos`, 'Lee comprobantes y oye notas de voz', 'Rescata interesados y te manda un resumen diario'],
  },
  profesional: {
    color: '#00a35c',
    items: [`Hasta ${PROFESIONAL.maxResources} profesionales · ${PROFESIONAL.maxSeats} accesos`, 'Expediente del cliente con archivos', 'El doble de uso de IA que Negocio'],
  },
  multisede: {
    color: '#f08c00',
    items: [`Profesionales ilimitados · ${MULTISEDE.maxSeats} accesos`, 'El mayor uso de IA incluido', 'Soporte prioritario'],
  },
}

export const FARES: Fare[] = PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  who: p.tagline,
  usd: p.priceUsd,
  mxn: p.priceMxn,
  popular: p.popular,
  ...FARE_COPY[p.id],
}))

// ---------------------------------------------------------------------
// FAQ — sincronizado con las capacidades reales (también alimenta el
// JSON-LD FAQPage de la página).
// ---------------------------------------------------------------------
// Las 6 primeras se ven en la home; el resto, tras «Ver 6 preguntas más».
export const FAQS = [
  {
    q: '¿Necesito saber programar para usar ChatVenti?',
    a: 'No. Creas tu cuenta, conectas tu WhatsApp con el inicio de sesión seguro de Meta, capturas tus servicios y horarios en el panel y activas la IA. Todo desde el navegador, sin instalar nada.',
  },
  {
    q: '¿Qué necesito para conectar mi WhatsApp?',
    a: 'Una cuenta de Facebook (o una cuenta de Meta para empresas), un número que pueda recibir un SMS o una llamada para verificarlo y que no esté activo en la app de WhatsApp, y el nombre que verán tus clientes. Lo conectas desde tu panel en Conexiones, en unos minutos. Mientras tanto puedes atender por Instagram, Messenger, Telegram y tu página de reservas.',
  },
  {
    q: '¿Cuánto cuestan los mensajes de WhatsApp, Instagram y Messenger?',
    a: 'Instagram y Messenger no tienen costo por mensaje: Meta no los cobra y vienen incluidos en todos los planes. WhatsApp sí lo cobra Meta, directo a la cuenta de WhatsApp de tu negocio y sin intermediarios: cada número tiene 1,000 mensajes de servicio gratis al mes (las respuestas a quien te escribe), así que a un negocio pequeño puede no costarle nada. Los recordatorios automáticos sí los cobra Meta, por mensaje y según tu país. Tu tarjeta la pones en Meta, no en ChatVenti.',
  },
  {
    q: '¿Qué pasa si la IA no sabe responder algo?',
    a: 'La IA está acotada a tu negocio: si algo se sale de lo configurado, escala la conversación a una persona y te avisa. Además puedes activar el modo aprobación, donde la IA te propone la respuesta y tú la apruebas con un botón antes de que se envíe.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: `Sí. No hay contratos forzosos ni penalizaciones: administras tu suscripción, cambias de plan o cancelas desde el portal de facturación de tu panel. Y empiezas con ${TRIAL_DAYS} días de prueba gratis, sin tarjeta de crédito.`,
  },
  {
    q: '¿Cuánto tarda la configuración?',
    a: 'Unos minutos: conectas tu canal, capturas servicios, precios y horarios, y activas a tu recepcionista. Si necesitas ayuda, te acompañamos por correo en soporte@chatventi.com.',
  },
  {
    q: '¿Cómo se conecta ChatVenti a WhatsApp?',
    a: 'Con la API oficial de WhatsApp Business (Meta), la misma tecnología que usan las grandes marcas. Nada de aplicaciones no oficiales ni celulares que deban quedarse prendidos: conectas la cuenta de WhatsApp Business de tu negocio desde el panel. También puedes activar Telegram y tu página de reservas web.',
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
    a: 'La recepcionista con IA por WhatsApp, Instagram, Messenger, Telegram y tu página de reservas va en los cuatro. Cambia el tamaño de tu equipo (cuántos profesionales agendan y cuántas personas entran al panel), las funciones avanzadas y cuánto uso de IA trae incluido cada mes. Si tu negocio crece, cambias de plan desde tu panel cuando quieras.',
  },
  {
    q: '¿Qué pasa si mi recepcionista atiende más de lo que incluye mi plan?',
    a: `Nunca se detiene. El plan Arranque incluye ${aiRepliesIncluded('arranque').toLocaleString('en-US')} respuestas de IA al mes y el plan Negocio ${aiRepliesIncluded('negocio').toLocaleString('en-US')}: mucho más de lo que usa un negocio normal. Si un mes lo rebasas, cada 1,000 respuestas adicionales cuestan ${fmtAmount(Number((EXTRA_REPLY_PRICE_MXN * 1000).toFixed(2)))} MXN más IVA en México (o $${(EXTRA_REPLY_PRICE_USD * 1000).toFixed(2)} USD fuera de México) y se suman a tu siguiente factura. Tu consumo lo ves en tiempo real en tu panel.`,
  },
  {
    q: '¿Hay descuento si pago el año completo?',
    a: `Sí: pagas 10 meses y usas 12. Eliges pago mensual o anual al activar tu plan, después de tus ${TRIAL_DAYS} días de prueba.`,
  },
]
