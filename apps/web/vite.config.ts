import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

const apiServerPort = Number(process.env.ONES_HOSTED_PORT ?? process.env.PORT ?? 3001);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.ONES_DEV_WEB_SERVER_PORT ?? 5173),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiServerPort}`,
        changeOrigin: true
      }
    }
  }
});
