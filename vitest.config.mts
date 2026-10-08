import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Pruebas unitarias (npm test). Solo lógica pura: nada toca la base ni la red.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
