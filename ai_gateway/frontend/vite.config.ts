import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5005',
      '/v1': 'http://localhost:5005',
      '/registry': 'http://localhost:5005',
      '/bus': 'http://localhost:5005',
    }
  }
})
