import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // говорим Vite, что корень проекта — src
  root: 'src',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'lucide-react': path.resolve(__dirname, 'vendor/lucide-react'),
    },
  },
  plugins: [react()],
  build: {
    // а билдить нужно в ../dist относительно src → в корневую dist
    outDir: '../dist',
    emptyOutDir: true,
  },
});
