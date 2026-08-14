import type { NextConfig } from 'next'

// Cabeceras de seguridad para TODA respuesta (hardening 2026-08-14).
// - HSTS: fuerza HTTPS (el dominio ya sirve solo por HTTPS).
// - X-Frame-Options DENY: el dashboard no puede embeberse -> anti-clickjacking.
// - nosniff / Referrer-Policy / Permissions-Policy: cierres estándar.
// CSP se deja fuera a propósito: el Embedded Signup carga el SDK de Facebook y
// una CSP mal calibrada lo rompería; se añadirá con lista de orígenes probada.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
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
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
