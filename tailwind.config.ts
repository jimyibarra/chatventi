import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design system ChatVenti (Ola 3): violeta de la landing (#5b4fe0)
        // como color de marca único en todo el producto.
        brand: {
          50: '#eeedfc',
          100: '#e0ddfa',
          200: '#c4bff5',
          300: '#a49bef',
          400: '#8073e8',
          500: '#5b4fe0',
          600: '#4c3fd3',
          700: '#4338ca',
          800: '#362da3',
          900: '#2b247d',
        },
        // Diseño «Líneas» (elegido por Juan el 2026-10-02, ver DESIGN.md): tinta
        // violeta profunda sobre un fondo azulado muy claro. Sustituye a los
        // grises del Bento Grid en todo el panel.
        ink: {
          DEFAULT: '#2a1a5e',
          muted: '#584d84',
          soft: '#665e8d',
          faint: '#7d7996',
        },
        surface: '#f1f4fb',
        line: {
          DEFAULT: '#dde2f0',
          soft: '#e6e9f4',
          row: '#edf0f8',
        },
        success: {
          DEFAULT: '#0d9463',
          bg: '#e4f7ef',
        },
        warn: {
          DEFAULT: '#a07408',
          strong: '#b8860b',
          bg: '#fdf3d7',
        },
      },
      borderRadius: {
        card: '20px',
      },
      fontFamily: {
        // Rubik se carga en el layout del panel (variable --font-rubik). Fuera
        // de él la variable no existe y cae a la pila del sistema, como antes.
        sans: ['var(--font-rubik)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'card-hover': '0 4px 20px rgba(91,79,224,.10)',
        btn: '0 2px 8px rgba(91,79,224,.30)',
      },
    },
  },
  plugins: [],
}

export default config
