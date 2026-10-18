import { defineConfig } from 'vite';

// GitHub Pages publica este projeto em /Fang-Yuan/ (não na raiz do domínio).
// Os hosts abertos permitem usar o preview do ambiente de desenvolvimento.
export default defineConfig({
  base: '/Fang-Yuan/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
