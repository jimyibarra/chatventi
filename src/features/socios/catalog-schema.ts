import { z } from 'zod'

// Esquemas del catálogo que manda el socio (servicios, horario, color). Viven
// aparte para que tanto el alta (service.ts) como PUT /catalog (catalog.ts)
// los usen sin importarse entre sí.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const serviceSchema = z.object({
  externalId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(600),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  priceText: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().default(true),
  position: z.number().int().min(0).max(10_000).default(0),
})

export const hourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens: z.string().regex(HHMM, 'Hora HH:MM').nullable().optional(),
    closes: z.string().regex(HHMM, 'Hora HH:MM').nullable().optional(),
    closed: z.boolean().default(false),
  })
  .refine((h) => h.closed || (h.opens && h.closes && h.opens < h.closes), 'Un día abierto necesita opens < closes')

/** Los tres campos, todos opcionales. El alta los acepta junto con los datos del negocio. */
export const catalogFields = {
  services: z.array(serviceSchema).max(100).optional(),
  hours: z.array(hourSchema).length(7).optional(),
  /** Color de la página del negocio (#rrggbb): tiñe su agenda pública. */
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'brandColor debe ser #rrggbb').optional(),
}

type CatalogLike = { services?: z.infer<typeof serviceSchema>[]; hours?: z.infer<typeof hourSchema>[] }

export const hoursCoverWeek = (c: CatalogLike) => !c.hours || new Set(c.hours.map((h) => h.weekday)).size === 7
export const serviceIdsUnique = (c: CatalogLike) =>
  !c.services || new Set(c.services.map((s) => s.externalId)).size === c.services.length

/** PUT /catalog: al menos una de las tres llaves. */
export const catalogSchema = z
  .object(catalogFields)
  .refine((c) => c.services || c.hours || c.brandColor, 'Manda services, hours, brandColor o varios')
  .refine(hoursCoverWeek, 'hours debe traer los 7 días, sin repetir')
  .refine(serviceIdsUnique, 'externalId repetido')

export type CatalogInput = z.infer<typeof catalogSchema>
export const hasCatalog = (c: Partial<CatalogInput>): boolean => !!(c.services || c.hours || c.brandColor)
