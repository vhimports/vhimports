import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src',
  envDir: '..',
  base: './',
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'src/index.html'),
        painel: resolve(import.meta.dirname, 'src/painel.html'),
      },
    },
  },
})

