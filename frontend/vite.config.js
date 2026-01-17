import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Handle SPA routing - serve index.html for all routes
    historyApiFallback: true,
    // Allow connections from any hostname (for local network access)
    allowedHosts: ['localhost', 'barmania.local', '.local', '.nip.io', '.sslip.io'],
  },
})
