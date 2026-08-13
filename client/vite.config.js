import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // dengarkan di semua interface (0.0.0.0), bukan cuma localhost
    proxy: {
      '/api': `http://localhost:${process.env.VITE_SERVER_PORT || (process.platform === 'darwin' ? 5001 : 5000)}`,
    },
  },
})