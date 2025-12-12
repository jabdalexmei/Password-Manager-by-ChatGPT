import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // говорим Vite, что корень проекта — src
  root: 'src',
  plugins: [react()],
  build: {
    // а билдить нужно в ../dist относительно src → в корневую dist
    outDir: '../dist',
    emptyOutDir: true,
  },
});
