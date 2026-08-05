// =====================================================================
// ChatVenti · Catálogo de capacidades del recepcionista IA
//
//   FUENTE DE VERDAD de lo que el agente sabe hacer. Se usa en el panel
//   (/dashboard/agente) y es reutilizable en la landing.
//
//   Por qué existe: el agente ya hacía mucho —agenda 24/7, escala a humano,
//   recuerda al cliente, manda recordatorios, consulta su base de
//   conocimiento— y nada de eso tenía nombre ni aparecía en ninguna lista.
//   No había nada que enseñar en una demo ni que listar en precios.
//
//   Dos tipos de capacidad:
//     · 'incluida'    — ya funciona siempre, no se apaga. Solo se NOMBRA.
//     · 'activable'   — nueva, con columna `cap_*` en agent_configs.
//
//   🔴 REGLA: toda capacidad activable nace APAGADA. Con todas apagadas el
//   sistema se comporta exactamente igual que antes de este catálogo.
// =====================================================================

/** Columnas `cap_*` de agent_configs. El nombre es el contrato con la BD. */
export const CAP_COLUMNS = [
  'cap_vision',
  'cap_transcribe',
  'cap_scoring',
  'cap_csat',
  'cap_cold_followup',
  'cap_daily_report',
] as const

export type CapColumn = (typeof CAP_COLUMNS)[number]

export type Capability = {
  id: string
  /** Nombre comercial. Es lo que ve el dueño y lo que se vende. */
  name: string
  /** Una frase, en lenguaje de dueño de negocio. Sin jerga. */
  description: string
  emoji: string
} & (
  | { kind: 'incluida' }
  | {
      kind: 'activable'
      column: CapColumn
      /** Advertencia honesta cuando la capacidad gasta consumo de IA. */
      consumesAi: boolean
    }
)

export const CAPABILITIES: Capability[] = [
  // ---------------------------------------------------------------
  // Lo que YA hace y nunca se había nombrado.
  // ---------------------------------------------------------------
  {
    id: 'agenda',
    kind: 'incluida',
    emoji: '📅',
    name: 'Agenda 24/7',
    description:
      'Consulta huecos reales, reserva, reagenda y cancela citas a cualquier hora, respetando duraciones y horarios de cada profesional.',
  },
  {
    id: 'escalamiento',
    kind: 'incluida',
    emoji: '🙋',
    name: 'Escala a una persona',
    description:
      'Cuando algo se sale de lo que sabe, o hay una queja, pasa la conversación a tu equipo y te avisa en vez de improvisar.',
  },
  {
    id: 'aprobacion',
    kind: 'incluida',
    emoji: '✅',
    name: 'Modo aprobación',
    description:
      'Puedes exigir tu visto bueno antes de que se envíe cada respuesta. Se aprueba con un botón desde Telegram.',
  },
  {
    id: 'memoria-cliente',
    kind: 'incluida',
    emoji: '🧠',
    name: 'Memoria del cliente',
    description:
      'Guarda el nombre y reconoce a quien ya escribió antes, con su historial de citas a la vista.',
  },
  {
    id: 'conocimiento',
    kind: 'incluida',
    emoji: '📚',
    name: 'Base de conocimiento',
    description:
      'Responde con la información que tú cargas —políticas, ubicación, formas de pago— y no inventa lo que no está.',
  },
  {
    id: 'recordatorios',
    kind: 'incluida',
    emoji: '🔔',
    name: 'Recordatorios automáticos',
    description:
      'Avisa 24 h y 2 h antes de cada cita, y puede invitar a volver pasado un tiempo. Menos ausencias sin que muevas un dedo.',
  },
  {
    id: 'botones',
    kind: 'incluida',
    emoji: '👆',
    name: 'Respuestas con botones',
    description:
      'Ofrece horarios y confirmaciones en botones, para que el cliente elija de un toque en vez de escribir.',
  },
  {
    id: 'voz-de-marca',
    kind: 'incluida',
    emoji: '🎨',
    name: 'Voz de marca',
    description:
      'Habla con el tono de tu negocio: de tú o de usted, con o sin emojis. Se puede deducir de tu propio sitio web.',
  },

  // ---------------------------------------------------------------
  // Nuevas. Nacen apagadas.
  // ---------------------------------------------------------------
  {
    id: 'vision',
    kind: 'activable',
    column: 'cap_vision',
    consumesAi: true,
    emoji: '👁️',
    name: 'Lee imágenes',
    description:
      'Entiende la foto de un comprobante de pago o de un producto y sigue la conversación, en vez de pasarla a una persona.',
  },
  {
    id: 'transcribe',
    kind: 'activable',
    column: 'cap_transcribe',
    consumesAi: true,
    emoji: '🎙️',
    name: 'Escucha notas de voz',
    description:
      'Transcribe los audios que te mandan y responde a lo que dicen. En WhatsApp la mitad de la gente habla en vez de escribir.',
  },
  {
    id: 'scoring',
    kind: 'activable',
    column: 'cap_scoring',
    consumesAi: true,
    emoji: '⭐',
    name: 'Vigila la calidad',
    description:
      'Califica cada conversación del 1 al 5 con un motivo, y te avisa cuando una sale mal para que puedas rescatarla.',
  },
  {
    id: 'csat',
    kind: 'activable',
    column: 'cap_csat',
    consumesAi: false,
    emoji: '💬',
    name: 'Pregunta qué tal fue',
    description:
      'Tras la cita pide una calificación al cliente y la registra, para que sepas cómo te está yendo de verdad.',
  },
  {
    id: 'cold-followup',
    kind: 'activable',
    column: 'cap_cold_followup',
    consumesAi: false,
    emoji: '🎣',
    name: 'Rescata interesados',
    description:
      'A quien preguntó y nunca agendó, le escribe UNA sola vez para reactivarlo. Hoy esos se pierden en silencio.',
  },
  {
    id: 'daily-report',
    kind: 'activable',
    column: 'cap_daily_report',
    consumesAi: false,
    emoji: '📊',
    name: 'Resumen diario',
    description:
      'Cada mañana te llega por correo lo que pasó ayer: conversaciones, citas, qué se escaló y cómo va la calidad.',
  },
]

export const INCLUDED_CAPABILITIES = CAPABILITIES.filter((c) => c.kind === 'incluida')
export const TOGGLEABLE_CAPABILITIES = CAPABILITIES.filter(
  (c): c is Extract<Capability, { kind: 'activable' }> => c.kind === 'activable'
)

/** Estado por defecto: TODO apagado = comportamiento anterior al catálogo. */
export function defaultCapabilityState(): Record<CapColumn, boolean> {
  return Object.fromEntries(CAP_COLUMNS.map((c) => [c, false])) as Record<CapColumn, boolean>
}

/**
 * Lee el estado de las capacidades de una fila de agent_configs.
 * Tolera que las columnas no existan todavía (migración sin aplicar) o que
 * lleguen null: en ambos casos la capacidad queda APAGADA, que es el estado
 * seguro y equivale al comportamiento de siempre.
 */
export function readCapabilities(row: unknown): Record<CapColumn, boolean> {
  const state = defaultCapabilityState()
  if (!row || typeof row !== 'object') return state
  const r = row as Record<string, unknown>
  for (const col of CAP_COLUMNS) {
    state[col] = r[col] === true
  }
  return state
}
