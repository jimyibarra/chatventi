import { describe, expect, it } from 'vitest'
import { BUSINESS_TEMPLATES, DEFAULT_TEMPLATE_KEY, giroBooks, normalizeBusinessType } from './business-templates'
import { STARTER_SERVICES } from '@/features/onboarding/starter-data'
import { servicePriceLabel } from './prompt-parts'
import { catalogSchema } from '@/features/socios/catalog-schema'

describe('giros', () => {
  it('cada giro tiene sus servicios iniciales y genérico va al final (respaldo de getTemplate)', () => {
    for (const t of BUSINESS_TEMPLATES) expect(STARTER_SERVICES[t.key]?.length, t.key).toBeGreaterThan(0)
    expect(BUSINESS_TEMPLATES[BUSINESS_TEMPLATES.length - 1].key).toBe(DEFAULT_TEMPLATE_KEY)
    expect(new Set(BUSINESS_TEMPLATES.map((t) => t.key)).size).toBe(BUSINESS_TEMPLATES.length)
  })

  it('reconoce los 14 giros de ¡Pasen! por su slug', () => {
    const pasen: Record<string, string> = {
      'barberia-estetica': 'barberia_estetica',
      'estetica-spa': 'spa_unas',
      dentista: 'dental',
      'consultorio-medico': 'medico',
      dermatologia: 'dermatologia',
      nutricion: 'nutricion',
      psicologia: 'psicologia',
      veterinaria: 'veterinaria',
      'restaurante-fruteria': 'restaurante',
      gimnasio: 'gimnasio',
      'yoga-pilates': 'yoga_pilates',
      'taller-mecanico': 'taller_mecanico',
      'despacho-contable': 'despacho_contable',
      'despacho-juridico': 'despacho_juridico',
    }
    for (const [slug, key] of Object.entries(pasen)) expect(normalizeBusinessType(slug), slug).toBe(key)
  })

  it('acepta las claves propias, manda lo desconocido a genérico y no inventa giro si no viene', () => {
    expect(normalizeBusinessType('spa_unas')).toBe('spa_unas')
    expect(normalizeBusinessType(' Taller Mecanico ')).toBe('taller_mecanico')
    expect(normalizeBusinessType('panaderia')).toBe('generico')
    expect(normalizeBusinessType('')).toBeUndefined()
    expect(normalizeBusinessType(undefined)).toBeUndefined()
  })

  it('solo el restaurante deja de agendar', () => {
    expect(giroBooks('restaurante')).toBe(false)
    expect(giroBooks('dental')).toBe(true)
    expect(giroBooks(null)).toBe(true)
  })
})

describe('servicePriceLabel', () => {
  it('el texto del dueño manda; sin precio, «precio por confirmar»', () => {
    expect(servicePriceLabel({ price: null, price_text: 'Desde $250' })).toBe('Desde $250')
    expect(servicePriceLabel({ price: 1200, price_text: null })).toBe('$1,200')
    expect(servicePriceLabel({ price: null, price_text: null })).toBe('precio por confirmar')
    expect(servicePriceLabel({ price: null, price_text: '  ' })).toBe('precio por confirmar')
  })
})

describe('catálogo del socio: reviewUrl', () => {
  it('acepta https, null para borrarlo, y basta solo para un PUT', () => {
    expect(catalogSchema.safeParse({ reviewUrl: 'https://g.page/r/abc/review' }).success).toBe(true)
    expect(catalogSchema.safeParse({ reviewUrl: null }).success).toBe(true)
  })

  it('rechaza http y textos que no son enlace', () => {
    expect(catalogSchema.safeParse({ reviewUrl: 'http://g.page/r/abc/review' }).success).toBe(false)
    expect(catalogSchema.safeParse({ reviewUrl: 'mi reseña' }).success).toBe(false)
  })

  it('sigue pidiendo al menos una llave', () => {
    expect(catalogSchema.safeParse({}).success).toBe(false)
  })
})

describe('candado de giro sin agenda', () => {
  it('detecta una oferta de horarios para cita', async () => {
    const { offersAppointmentSlots } = await import('./prompt-parts')
    expect(offersAppointmentSlots('No agendamos citas. Sin embargo, puedo ofrecerle:\n- 9:00 am\n- 4:30 pm')).toBe(true)
    expect(offersAppointmentSlots('Tengo estos horarios disponibles: 12:45 pm')).toBe(true)
  })
  it('deja pasar el horario del negocio y respuestas sin horas', async () => {
    const { offersAppointmentSlots } = await import('./prompt-parts')
    expect(offersAppointmentSlots('Abrimos de lunes a sábado de 9:00 a 18:00.')).toBe(false)
    expect(offersAppointmentSlots('Aquí no agendamos citas, pero te ayudo con tu pedido.')).toBe(false)
  })
})
