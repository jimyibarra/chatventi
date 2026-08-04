import { ImageResponse } from 'next/og'
import { VERTICALS, verticalBySlug } from '@/features/verticales/data'
import { verticalContent } from '@/features/verticales/content'

// Imagen OG propia de cada landing por giro. Sin ella, las 5 páginas
// compartirían la tarjeta genérica del sitio al compartirse en WhatsApp.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return VERTICALS.map((v) => ({ giro: v.slug }))
}

export default async function Image({ params }: { params: Promise<{ giro: string }> }) {
  const { giro } = await params
  const vertical = verticalBySlug(giro)
  const content = verticalContent(giro)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: 'linear-gradient(135deg, #F4F2FE 0%, #FBFAF6 70%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 34, fontSize: 30, color: '#4A3FC4', fontWeight: 600 }}>
          <span>{vertical?.emoji ?? '📅'}</span>
          <span>Hecho para {vertical?.label.toLowerCase() ?? 'negocios de citas'}</span>
        </div>

        <div
          style={{
            fontSize: 66,
            fontWeight: 800,
            color: '#201B36',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            maxWidth: 940,
          }}
        >
          {content?.h1 ?? 'Tu recepcionista con IA que agenda citas por WhatsApp'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 54, fontSize: 38, fontWeight: 800, color: '#5B4FE0' }}>
          ChatVenti
        </div>
      </div>
    ),
    size,
  )
}
