// Color de marca de cada negocio (lo elige el dueño en Reservas Web). Puede ser
// cualquier tono, también uno claro: aquí se decide qué texto aguanta encima.

const INK = '#2a1a5e'
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** El color si es un hex válido; si no, el de respaldo. */
export function safeHex(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value.trim()) ? value.trim() : fallback
}

function luminance(hex: string): number {
  let h = hex.slice(1)
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

/** Texto que se lee SOBRE el color: blanco si pasa 4.5:1, si no la tinta. */
export function textOn(hex: string): string {
  return contrastWithWhite(hex) >= 4.5 ? '#ffffff' : INK
}

/** El color como texto o trazo sobre blanco: él mismo si pasa 3:1, si no la tinta. */
export function strokeOnWhite(hex: string): string {
  return contrastWithWhite(hex) >= 3 ? hex : INK
}
