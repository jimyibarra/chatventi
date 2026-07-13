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
        // Bento Grid claro (PRP prp-rediseno-bento-claro): tokens de la tarjeta
        // aprobada en Claude Design (comparativa/panel-bento.html).
        ink: {
          DEFAULT: '#1a1830',
          muted: '#6b6a80',
          soft: '#8a89a0',
          faint: '#9997ae',
        },
        surface: '#f6f6fa',
        line: {
          DEFAULT: '#e8e7f2',
          soft: '#eceaf5',
          row: '#f1f0f8',
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
        card: '18px',
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
