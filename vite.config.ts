import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy FanGraphs API through the dev server to avoid CORS / 403 blocks
      '/fg-proxy': {
        target: 'https://www.fangraphs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fg-proxy/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://www.fangraphs.com/leaders/major-league',
          'Accept': 'application/json, text/plain, */*',
        },
      },
    },
  },
})
