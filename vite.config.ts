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
    // Sem `strictPort` no dev: se 5173 estiver ocupada o Vite escolhe outra
    // porta em vez de falhar. O preview continua estrito.
    strictPort: false,
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
    // Sourcemap só sob demanda (`npm run build:debug`): o mapa do Phaser sozinho
    // passa de 11 MB e iria inteiro para o Pages em todo deploy.
    sourcemap: process.env.SOURCEMAP === 'true' ? 'hidden' : false,
    rollupOptions: {
      output: {
        // Phaser muda menos que o jogo: separado, continua em cache do jogador
        // entre versões e o bundle do jogo fica pequeno.
        // (Vite 8/rolldown aceita só a forma de função.)
        manualChunks(id: string) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
});
