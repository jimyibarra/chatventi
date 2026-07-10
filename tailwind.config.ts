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
      },
    },
  },
  plugins: [],
}

export default config
