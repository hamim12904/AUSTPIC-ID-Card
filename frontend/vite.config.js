import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api/* to the Express backend during dev so the browser never has
// to deal with CORS — the frontend just calls same-origin '/api/...'.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
