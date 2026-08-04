import type { MetadataRoute } from 'next'
import { LEGAL } from '@/shared/constants/legal'
import { VERTICALS } from '@/features/verticales/data'

// Sirve /sitemap.xml. Solo rutas públicas y estables: la home, las landings por
// giro y las legales. Las páginas de reservas /r/<slug> son por inquilino y
// cambian solas; no se listan aquí para no exponer el censo de clientes.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = LEGAL.siteUrl

  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...VERTICALS.map((v) => ({
      url: `${base}/para/${v.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${base}/privacy`, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly' as const, priority: 0.3 },
  ]
}
