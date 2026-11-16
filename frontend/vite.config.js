import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const isHttps = process.env.VITE_HTTPS === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(isHttps ? [basicSsl()] : [])
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    https: isHttps,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'leaflet-vendor': ['leaflet'],
          'socket-vendor': ['socket.io-client'],
          'lucide-vendor': ['lucide-react']
        }
      }
    }
  }
});
