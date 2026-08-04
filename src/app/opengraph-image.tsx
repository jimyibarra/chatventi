import { ImageResponse } from 'next/og'

// Imagen OpenGraph por defecto de todo el sitio (WhatsApp, Facebook, X, LinkedIn).
// Antes no existía ninguna: compartir un enlace mostraba una tarjeta vacía.
// Se genera con tipografía del sistema a propósito — sin fuentes remotas ni
// assets externos, para que no dependa de la red al construir.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'ChatVenti — recepcionista con IA que agenda citas por WhatsApp'

export default function OpengraphImage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 34 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#25D366' }} />
          <div style={{ fontSize: 28, color: '#128C4A', fontWeight: 600 }}>
            Respondiendo WhatsApps 24/7
          </div>
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#201B36',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: 900,
          }}
        >
          Tu recepcionista con IA que agenda citas por WhatsApp
        </div>

        <div style={{ fontSize: 34, color: '#5F5A75', marginTop: 30, maxWidth: 860 }}>
          Contesta al instante, agenda y recuerda cada cita. Sin dobles reservas.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 52,
            fontSize: 40,
            fontWeight: 800,
            color: '#5B4FE0',
          }}
        >
          ChatVenti
        </div>
      </div>
    ),
    size,
  )
}
