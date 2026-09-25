import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Configuração exclusiva para QA; não carrega .env, Auth nem o banco remoto.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envFile: false,
  plugins: [{ name: 'isolated-supabase-fixture', enforce: 'pre', resolveId(source) {
    if (source === '../lib/supabase') return fileURLToPath(new URL('./fixture.js', import.meta.url))
  } }, react()],
  server: { host: '127.0.0.1', port: 3001, strictPort: true },
})

