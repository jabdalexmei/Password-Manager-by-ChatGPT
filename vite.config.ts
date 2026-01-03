import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // говорим Vite, что корень проекта — src
  root: 'src',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
     
    },
  },
  plugins: [react()],
  build: {
    // а билдить нужно в ../dist относительно src → в корневую dist
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Basic vendor chunking for better caching & smaller main chunk.
        // Vite exposes this Rollup option directly.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react';
          }
          if (id.includes('/@tauri-apps/')) {
            return 'tauri';
          }
          return 'vendor';
        },
      },
    },
  },
});
