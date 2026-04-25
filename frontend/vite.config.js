import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/indiamart': {
        target: 'https://seller.indiamart.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/indiamart/, ''),
        headers: {
          'Origin': 'https://seller.indiamart.com',
          'Referer': 'https://seller.indiamart.com/leadmanager/'
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.headers['x-proxy-cookie']) {
              proxyReq.setHeader('Cookie', req.headers['x-proxy-cookie']);
            }
          });
        }
      }
    }
  }
})
