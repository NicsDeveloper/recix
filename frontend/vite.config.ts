import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/charges': { target: API_TARGET, changeOrigin: true },
      '/payment-events': { target: API_TARGET, changeOrigin: true },
      '/reconciliations': { target: API_TARGET, changeOrigin: true },
      '/webhooks': { target: API_TARGET, changeOrigin: true },
      '/dashboard': { target: API_TARGET, changeOrigin: true },
      '/ai': { target: API_TARGET, changeOrigin: true },
    },
  },
})
