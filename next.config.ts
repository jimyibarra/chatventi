import type { NextConfig } from 'next'

// Cabeceras de seguridad para TODA respuesta (hardening 2026-08-14).
// - HSTS: fuerza HTTPS (el dominio ya sirve solo por HTTPS).
// - X-Frame-Options DENY: el dashboard no puede embeberse -> anti-clickjacking.
//   Única excepción (2026-10-06): la agenda pública /r/<slug>?embed=1, que el
//   widget.js y los sitios de PASEN abren dentro de un iframe. Sin sesión ni
//   pago: un clic engañado ahí no agenda nada. El resto de /r/* sigue en DENY.
// - nosniff / Referrer-Policy / Permissions-Policy: cierres estándar.
// CSP se deja fuera a propósito: el Embedded Signup carga el SDK de Facebook y
// una CSP mal calibrada lo rompería; se añadirá con lista de orígenes probada.
const noFrame = { key: 'X-Frame-Options', value: 'DENY' }
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  async headers() {
    return [
      // Todo menos /r/*: cierres estándar + DENY.
      { source: '/((?!r/).*)', headers: [...securityHeaders, noFrame] },
      // /r/*: cierres estándar siempre; DENY salvo en la versión embebida (?embed=1).
      { source: '/r/:path*', headers: securityHeaders },
      { source: '/r/:path*', missing: [{ type: 'query', key: 'embed', value: '1' }], headers: [noFrame] },
    ]
  },
}

export default nextConfig
