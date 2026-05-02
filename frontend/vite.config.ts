import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Garante que o proxy não bufferize streams (SSE)
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
      '/hubs': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
