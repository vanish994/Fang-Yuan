import { defineConfig } from 'vite';

// Vite config para o jogo Phaser 4.
// - host 0.0.0.0: permite acesso pelo preview do ambiente e pela rede local.
// - allowedHosts: o preview roda atrás de um proxy com host dinâmico, então liberamos todos.
export default defineConfig({
  // GitHub Pages publica este repositório em /Fang-Yuan/.
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
    // Phaser é grande por natureza (~1.5 MB minificado); o aviso padrão de 500 kB não ajuda aqui.
    chunkSizeWarningLimit: 2000,
  },
});
