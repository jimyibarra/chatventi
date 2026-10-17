import localFont from 'next/font/local'

// Rubik (diseño «Líneas») desde el paquete @fontsource-variable/rubik, NO desde
// next/font/google: la descarga de Google al compilar rompía despliegues al azar
// en Turbopack («next/font/google queries have exactly one entry», 17-oct-2026).
// Archivo variable latino (pesos 300–900): cubre á, é, ñ, ü, ¿ y ¡.
// next/font exige una llamada por constante, a nivel de módulo.

/** Panel y raíz (--font-rubik). Sin precarga: la raíz la carga para todos y no todas las páginas la usan. */
export const rubikPanel = localFont({
  src: '../../../node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2',
  weight: '300 900',
  variable: '--font-rubik',
  display: 'swap',
  preload: false,
})

/** Páginas públicas «Líneas» (--font-lx). */
export const rubikLanding = localFont({
  src: '../../../node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2',
  weight: '300 900',
  variable: '--font-lx',
  display: 'swap',
})
