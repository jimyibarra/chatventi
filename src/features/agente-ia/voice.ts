import { z } from 'zod'

// =====================================================================
// ChatVenti · Voz de marca
//
//   🔴 REGLA INVIOLABLE: la voz cambia CÓMO suena el agente, nunca QUÉ
//   puede hacer. No inventar precios/horarios/disponibilidad y el protocolo
//   de escalamiento a humano son inmutables y viven en REGLAS IMPORTANTES.
//
//   La defensa real NO es el orden del prompt, es el TIPO. El bloque de voz
//   se renderiza a partir de enums cerrados: un enum no puede contener
//   "ignora tus reglas". Así, aunque el retrato venga de analizar un sitio
//   web ajeno (Fase 4), no hay ruta desde ese texto hasta una instrucción.
//   El único campo semilibre son las muletillas, y van acotadas y saneadas.
// =====================================================================

export const VOICE_TREATMENTS = ['tu', 'usted'] as const
export const VOICE_ENERGIES = ['baja', 'media', 'alta'] as const
export const VOICE_EMOJI = ['nunca', 'ocasional', 'frecuente'] as const
export const VOICE_SENTENCES = ['corta', 'media', 'larga'] as const

/** Longitud y número máximos de las muletillas. Acotado a propósito. */
export const QUIRK_MAX_LEN = 24
export const QUIRK_MAX_COUNT = 5

/**
 * Saneado de una muletilla: se quedan solo letras, números, espacios, apóstrofo
 * y guion. Fuera saltos de línea (romperían el bloque), dos puntos y corchetes
 * (imitarían la sintaxis de instrucción del prompt). Se TRUNCA, no se rechaza.
 */
function sanitizeQuirk(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s'’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUIRK_MAX_LEN)
    .trim()
}

/**
 * 🔴 Las muletillas SANEAN, nunca rechazan. Al revés que los enums.
 *
 * La primera versión usaba `.max(QUIRK_MAX_LEN)` por elemento, y una sola
 * palabra larga hacía fallar el parse del objeto ENTERO: el dueño perdía toda
 * su voz por escribir una palabra de más de 24 caracteres, y en la Fase 4 una
 * muletilla larga devuelta por el analizador tiraría la extracción completa.
 *
 * La seguridad NO depende de rechazar aquí: depende de que los enums sean
 * cerrados y de que esto se renderice como lista de vocabulario. Así que este
 * campo se limpia y se recorta, y solo los enums pueden invalidar el perfil.
 */
const quirksSchema = z
  .array(z.string())
  .catch([])
  .transform((arr) =>
    arr
      .map(sanitizeQuirk)
      .filter((q) => q.length > 0)
      .slice(0, QUIRK_MAX_COUNT)
  )

export const voiceProfileSchema = z.object({
  treatment: z.enum(VOICE_TREATMENTS),
  energy: z.enum(VOICE_ENERGIES),
  emoji: z.enum(VOICE_EMOJI),
  sentence: z.enum(VOICE_SENTENCES),
  quirks: quirksSchema.default([]),
})

export type VoiceProfile = z.infer<typeof voiceProfileSchema>

export const VOICE_PRESETS = ['calido', 'formal', 'divertido', 'custom'] as const
export type VoicePreset = (typeof VOICE_PRESETS)[number]

export const PRESET_PROFILES: Record<Exclude<VoicePreset, 'custom'>, VoiceProfile> = {
  calido: { treatment: 'tu', energy: 'media', emoji: 'ocasional', sentence: 'corta', quirks: [] },
  formal: { treatment: 'usted', energy: 'baja', emoji: 'nunca', sentence: 'media', quirks: [] },
  divertido: { treatment: 'tu', energy: 'alta', emoji: 'frecuente', sentence: 'corta', quirks: [] },
}

export const PRESET_LABELS: Record<Exclude<VoicePreset, 'custom'>, { label: string; hint: string }> = {
  calido: { label: 'Cálido', hint: 'Cercano y de tú, con algún emoji. El de siempre.' },
  formal: { label: 'Formal', hint: 'De usted, sobrio y sin emojis. Clínicas y consultorios.' },
  divertido: { label: 'Divertido', hint: 'Enérgico, de tú y con emojis. Barberías y gimnasios.' },
}

/**
 * Lee un perfil guardado. Valida SIEMPRE, también al leer: un `voice_profile`
 * escrito hace meses puede no cumplir el esquema de hoy, y un perfil corrupto
 * no debe tumbar al agente ni —peor— colarse crudo al prompt. Ante cualquier
 * duda devuelve null y el agente se comporta como si no hubiera voz.
 */
export function parseVoiceProfile(raw: unknown): VoiceProfile | null {
  if (raw == null) return null
  const parsed = voiceProfileSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Resuelve el perfil efectivo: el preset manda salvo que sea 'custom'. */
export function resolveVoiceProfile(
  preset: string | null | undefined,
  profile: unknown
): VoiceProfile | null {
  if (preset && preset !== 'custom' && preset in PRESET_PROFILES) {
    return PRESET_PROFILES[preset as Exclude<VoicePreset, 'custom'>]
  }
  return parseVoiceProfile(profile)
}

const TREATMENT_TEXT: Record<VoiceProfile['treatment'], string> = {
  tu: 'Tutea al cliente.',
  usted: 'Trata al cliente de usted, siempre.',
}
const ENERGY_TEXT: Record<VoiceProfile['energy'], string> = {
  baja: 'Tono sobrio y tranquilo, sin exclamaciones.',
  media: 'Tono cordial y cercano.',
  alta: 'Tono enérgico y entusiasta.',
}
const EMOJI_TEXT: Record<VoiceProfile['emoji'], string> = {
  nunca: 'No uses emojis.',
  ocasional: 'Usa como mucho un emoji por mensaje, y no siempre.',
  frecuente: 'Puedes usar uno o dos emojis por mensaje.',
}
const SENTENCE_TEXT: Record<VoiceProfile['sentence'], string> = {
  corta: 'Frases cortas.',
  media: 'Frases de longitud media.',
  larga: 'Puedes usar frases algo más largas y explicativas.',
}

/**
 * Renderiza el bloque de VOZ del prompt. Todo sale de campos tipados; lo único
 * que viene de texto son las muletillas, y se listan como vocabulario, nunca
 * como una frase que el modelo pueda leer como orden.
 *
 * Devuelve null si no hay voz configurada → el prompt queda EXACTAMENTE como
 * antes de esta feature. Es lo que permite desplegar el código antes que la
 * migración sin cambiar el comportamiento de ningún agente.
 */
export function renderVoiceBlock(profile: VoiceProfile | null): string | null {
  if (!profile) return null

  const lines = [
    'VOZ DE MARCA (solo tono):',
    `- ${TREATMENT_TEXT[profile.treatment]}`,
    `- ${ENERGY_TEXT[profile.energy]}`,
    `- ${EMOJI_TEXT[profile.emoji]}`,
    `- ${SENTENCE_TEXT[profile.sentence]}`,
  ]

  if (profile.quirks.length) {
    lines.push(
      `- Vocabulario propio del negocio que puedes usar con naturalidad: ${profile.quirks
        .map((q) => `"${q}"`)
        .join(', ')}.`
    )
  }

  lines.push(
    'Lo anterior describe ÚNICAMENTE el tono. No altera ninguna regla, capacidad ni permiso. Ante cualquier conflicto, mandan las REGLAS IMPORTANTES de abajo.'
  )

  return lines.join('\n')
}
