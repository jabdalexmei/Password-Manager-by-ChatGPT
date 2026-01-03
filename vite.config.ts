import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  // говорим Vite, что корень проекта — src
  root: 'src',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
     
    },
  },
  plugins: [
    react(),
    ...(mode === 'analyze'
      ? [visualizer({ filename: '../dist/stats.html', open: true })]
      : []),
  ],
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

          if (id.includes('/@zxing/')) return 'zxing';
          if (id.includes('/otpauth/')) return 'otpauth';
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
}));
