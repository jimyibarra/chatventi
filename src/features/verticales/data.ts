// =====================================================================
// ChatVenti · Catálogo ÚNICO de verticales (giros de negocio)
//
//   FUENTE DE VERDAD para: rutas /para/[giro], sitemap, tarjetas de la
//   landing, barra de confianza, y el copy por rubro del quiz.
//
//   Antes de este archivo la taxonomía vivía TRIPLICADA y desalineada:
//     · 6 claves en agente-ia/business-templates.ts  (única con veterinaria)
//     · 4 tarjetas en landing/data.ts → INDUSTRIES   (sin veterinaria)
//     · 6 strings sueltos en la barra de confianza    (sin veterinaria)
//     · 5 casos en marketing/config.ts → businessNoun
//   Resultado: `veterinaria` era un giro soportado por el producto e
//   INVISIBLE en todo el marketing. Cualquier lista nueva se deriva de aquí.
//
//   `businessType` DEBE coincidir con una clave de BUSINESS_TEMPLATES
//   (agente-ia/business-templates.ts) porque es lo que acaba en
//   organizations.business_type y selecciona la plantilla del agente.
//   El giro `generico` NO tiene landing a propósito: nadie busca "agenda
//   para negocio genérico" y una página así sería contenido delgado.
// =====================================================================

export type Vertical = {
  /** Segmento de URL: /para/<slug>. Estable — cambiarlo rompe enlaces e indexación. */
  slug: string
  /** Clave de BUSINESS_TEMPLATES → organizations.business_type. */
  businessType: string
  emoji: string
  /** Nombre del giro en plural, para títulos y listados. */
  label: string
  /** Sustantivo posesivo para copy personalizado ("tu barbería"). */
  noun: string
  /** Etiquetas de la barra de confianza de la home. Vacío = no se muestra. */
  trustLabels: string[]
}

export const VERTICALS: Vertical[] = [
  {
    slug: 'barberia',
    businessType: 'barberia_estetica',
    emoji: '💈',
    label: 'Barberías y peluquerías',
    noun: 'tu barbería o estética',
    trustLabels: ['✂ Peluquerías', '💈 Barberías'],
  },
  {
    slug: 'dentista',
    businessType: 'dental',
    emoji: '🦷',
    label: 'Clínicas dentales',
    noun: 'tu clínica dental',
    trustLabels: ['🦷 Dentistas'],
  },
  {
    slug: 'veterinaria',
    businessType: 'veterinaria',
    emoji: '🐾',
    label: 'Veterinarias',
    noun: 'tu veterinaria',
    // Hoy vacío para no alterar el aspecto de la home en esta fase.
    trustLabels: [],
  },
  {
    slug: 'spa',
    businessType: 'spa_unas',
    emoji: '💅',
    label: 'Spas y estudios de uñas',
    noun: 'tu spa',
    trustLabels: ['💆 Spas', '✨ Clínicas estéticas'],
  },
  {
    slug: 'consultorio-medico',
    businessType: 'medico',
    emoji: '🩺',
    label: 'Consultorios médicos',
    noun: 'tu consultorio',
    trustLabels: ['🩺 Consultorios'],
  },
]

/** Slugs válidos para /para/[giro]. Cualquier otro debe dar 404. */
export const VERTICAL_SLUGS = VERTICALS.map((v) => v.slug)

export function verticalBySlug(slug: string | null | undefined): Vertical | null {
  return VERTICALS.find((v) => v.slug === slug) ?? null
}

export function verticalByBusinessType(businessType: string | null | undefined): Vertical | null {
  return VERTICALS.find((v) => v.businessType === businessType) ?? null
}

/**
 * Etiquetas de la barra de confianza de la home, derivadas del catálogo.
 * Sustituye a la lista hardcodeada que vivía dentro de app/page.tsx.
 */
export const TRUST_LABELS: string[] = VERTICALS.flatMap((v) => v.trustLabels)
