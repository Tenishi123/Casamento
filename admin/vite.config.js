import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Casamento/admin/' : '/',
  plugins: [react()],
  server: {
    port: 5174,
    watch: {
      ignored: ['**/.vs/**', '**/api/**'],
    },
  },
}))
