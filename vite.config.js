import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Casamento/' : '/',
  server: {
    watch: {
      ignored: ['**/.vs/**', '**/api/**', '**/public/Images/**', '**/public/music/**'],
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
}))
