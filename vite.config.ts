import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  // Absolute base required for BrowserRouter deep-links on Cloudflare Pages SPA.
  // Relative './' breaks /sales/income, /production/bulk, etc. (assets resolve under the path).
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  }
});
