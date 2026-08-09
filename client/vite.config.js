import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // dengarkan di semua interface (0.0.0.0), bukan cuma localhost
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})