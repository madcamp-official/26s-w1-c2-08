import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget =
  process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000'

const proxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/media': {
    target: backendTarget,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
})
