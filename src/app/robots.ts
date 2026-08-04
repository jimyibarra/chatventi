import type { MetadataRoute } from 'next'
import { LEGAL } from '@/shared/constants/legal'

// Sirve /robots.txt. Todo lo privado o con token queda fuera del índice.
//   · /c/<token>  → enlace mágico de gestión de cita: NUNCA indexar (da acceso
//                   a los datos de una cita concreta sin login).
//   · /invitacion/<token> → invitación de equipo: mismo motivo.
//   · /r/<slug>   → SÍ se indexa: es la página pública de reservas del negocio.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/admin/', '/c/', '/invitacion/', '/bienvenida'],
    },
    sitemap: `${LEGAL.siteUrl}/sitemap.xml`,
    host: LEGAL.siteUrl,
  }
}
