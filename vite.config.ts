import path from 'node:path';
import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'vite-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()];

  if (mode === 'analyze') {
    plugins.push(
      visualizer({
        filename: '../dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      })
    );
  }

  return {
    // Vite project root is src
    root: 'src',
    // Safer for Tauri/file protocol + chunked builds
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins,
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const n = id.replaceAll('\\', '/');

            if (n.includes('node_modules')) {
              if (n.includes('/react/') || n.includes('/react-dom/')) return 'vendor-react';
              if (n.includes('/@tauri-apps/')) return 'vendor-tauri';
              if (n.includes('/@zxing/')) return 'vendor-zxing';
              if (n.includes('/otpauth/')) return 'vendor-otpauth';
              return 'vendor';
            }

            if (n.includes('/src/features/Vault/')) return 'feature-vault';
            if (n.includes('/src/features/Workspace/')) return 'feature-workspace';
            if (n.includes('/src/features/Startup/')) return 'feature-startup';
            if (n.includes('/src/features/ProfileCreate/')) return 'feature-profile-create';
            if (n.includes('/src/features/LogIn/')) return 'feature-login';

            return undefined;
          },
        },
      },
    },
  };
});
