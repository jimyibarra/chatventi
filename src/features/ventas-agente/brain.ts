// =====================================================================
// ChatVenti · Cerebro del AGENTE DE VENTAS (no es el recepcionista de citas).
//
//   Un solo cerebro para TRES canales: el widget de la landing (web), y —en
//   la Pieza B— la página de Facebook y el Instagram de ChatVenti. Aquí vive
//   el conocimiento y las reglas; cada canal solo le pasa el historial.
//
//   Los PRECIOS y planes salen de plans.ts (fuente de verdad): si cambian ahí,
//   el vendedor deja de mentir solo. NUNCA hardcodear un precio en este archivo.
// =====================================================================
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  PLANS,
  TRIAL_DAYS,
  ADDON_PWA_USD,
  ADDON_DOMAIN_USD,
  ADDON_SEAT_USD,
  STARTER_PRICE_USD,
} from '@/features/billing/plans'

export type SalesTurn = { role: 'user' | 'assistant'; content: string }

// Datos verificables del catálogo, en un bloque que el modelo cita tal cual.
function pricingFacts(): string {
  const planLines = PLANS.map((p) => {
    const resources =
      p.maxResources === null ? 'profesionales ilimitados' : `hasta ${p.maxResources} profesional(es)`
    const seats = `${p.maxSeats} acceso(s) de equipo`
    const canales = p.aiChannels.join(', ')
    const extra = [
      p.includesPwa ? '"Tu App" (PWA de marca) incluida' : null,
      p.includesDomain ? 'dominio propio incluido' : null,
      p.hasSuperpowers ? 'superpoderes del agente (lee comprobantes, oye notas de voz, encuesta)' : null,
    ]
      .filter(Boolean)
      .join('; ')
    return `- ${p.name}: $${p.priceUsd} USD/mes${p.popular ? ' (EL MÁS POPULAR)' : ''}. ${p.tagline} Canales del agente: ${canales}. ${resources}, ${seats}.${extra ? ' Incluye: ' + extra + '.' : ''}`
  }).join('\n')

  return [
    `PLANES (precios en USD al mes, desde $${STARTER_PRICE_USD}):`,
    planLines,
    '',
    'COMPLEMENTOS (opcionales, USD/mes): "Tu App" (PWA de marca) $' +
      ADDON_PWA_USD +
      '; dominio propio $' +
      ADDON_DOMAIN_USD +
      '; acceso de equipo adicional $' +
      ADDON_SEAT_USD +
      '.',
    `PRUEBA GRATIS: ${TRIAL_DAYS} días, sin tarjeta de crédito. Se activa creando la cuenta en /signup.`,
    'IMPORTANTE de canales: WhatsApp, web y Telegram están en TODOS los planes. Instagram y Messenger entran desde el plan Profesional.',
  ].join('\n')
}

function systemPrompt(): string {
  return [
    'Eres el asesor de ventas de ChatVenti. Tu trabajo es resolver dudas de negocios interesados y ayudarles a empezar su prueba gratis. NO agendas citas ni atiendes a clientes finales: eso lo hace el producto una vez que el negocio se registra.',
    '',
    'QUÉ ES CHATVENTI: un recepcionista con inteligencia artificial que atiende por WhatsApp, Instagram, Messenger, Telegram y un widget en la web del negocio. Contesta al instante 24/7, agenda y confirma citas, evita dobles reservas, manda recordatorios y lleva un CRM de clientes. Está hecho para negocios que viven de su agenda: peluquerías, barberías, dentistas, veterinarias, spas, estéticas y consultorios. No hay que instalar nada ni saber de tecnología; queda listo en minutos.',
    '',
    pricingFacts(),
    '',
    'REGLAS:',
    '- Responde en español, cálido, cercano y BREVE (2-4 frases). Es un chat. Haz UNA sola pregunta por mensaje.',
    '- Escribe en TEXTO PLANO. Nada de markdown: sin **negritas**, sin _cursivas_, sin # títulos, sin tablas. Si enumeras, cada punto en su propia línea.',
    '- Habla SOLO de ChatVenti (qué hace, para quién, precios, canales, cómo empezar, cómo se compara). Si te preguntan algo ajeno, decláralo con amabilidad y reconduce a cómo ChatVenti puede ayudar a su negocio.',
    '- NUNCA inventes precios, planes ni funciones que no estén arriba. Si no sabes un dato concreto (facturas fiscales, casos muy específicos, integraciones raras), dilo con honestidad y ofrece que lo vean creando la cuenta gratis o escribiendo al equipo.',
    '- Cuando detectes intención (pregunta por precio, por su rubro, "cómo empiezo", "quiero probarlo"), INVITA a crear la cuenta gratis: di que la prueba es de ' +
      TRIAL_DAYS +
      ' días sin tarjeta y que en el botón "Prueba gratis" quedan listos en minutos. No presiones; ayuda.',
    '- Si preguntan por su rubro (ej. "¿sirve para mi veterinaria?"), responde que SÍ y por qué (agenda + atención automática 24/7 en su canal), con un ejemplo de su giro.',
    '- Si el interesado quiere hablar con una persona o tiene un caso complejo, sugiérele registrarse (así lo atienden dentro) o escribir a soporte@chatventi.com.',
  ].join('\n')
}

/**
 * Genera la respuesta del vendedor a partir del historial. Sin herramientas:
 * es Q&A + conversión, no un motor de reservas. Devuelve null si no hay clave
 * o si el modelo falla (quien llama muestra un fallback amable).
 */
export async function salesReply(history: SalesTurn[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  // Solo los últimos turnos: una conversación de venta no necesita más y acota
  // el coste. El historial ya viene recortado del endpoint, esto es cinturón.
  const messages = history.slice(-12)

  try {
    const openrouter = createOpenRouter({ apiKey })
    const model = openrouter('openai/gpt-4o-mini')
    const result = await generateText({
      model,
      system: systemPrompt(),
      messages,
    })
    const text = result.text?.trim()
    return text && text.length > 0 ? text : null
  } catch (err) {
    console.error('[ventas-agente] generateText error', err)
    return null
  }
}
