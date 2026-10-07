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
        // Leen variables CSS (globals.css) para que un socio con marca propia
        // (¡Pasen!) pueda recolorear su panel sin otra hoja de estilos.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
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
        // Rubik se carga en el layout raíz (variable --font-rubik en <html>).
        // El respaldo DENTRO del var() no es decorativo: un var() sin respaldo
        // cuya variable no existe invalida la declaración ENTERA de font-family
        // (no salta al siguiente de la lista) y el navegador cae a su serif.
        sans: ['var(--font-rubik, ui-sans-serif)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
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
