import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    headers: securityHeaders,
    proxy: { '/api': 'http://localhost:8010', '/media': 'http://localhost:8010' },
  },
  preview: { host: '127.0.0.1', headers: securityHeaders },
})
