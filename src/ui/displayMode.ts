/** Tela cheia só pode ser solicitada por gesto do usuário; orientação é melhor esforço. */
export function setupDisplayMode(): void {
  const button = document.getElementById('fullscreen-toggle') as HTMLButtonElement | null;
  const feedback = document.getElementById('display-feedback');
  if (!button || !feedback) throw new Error('Controles de exibição não encontrados.');

  const blockedMessage = () => typeof window !== 'undefined' && window.self !== window.top
    ? 'Tela cheia bloqueada nesta prévia. Abra o jogo em uma aba do navegador para tentar novamente.'
    : 'Tela cheia não permitida. Verifique as opções do navegador.';
  const sync = () => {
    const active = Boolean(document.fullscreenElement);
    const label = active ? 'Sair da tela cheia' : 'Entrar em tela cheia';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    button.title = label;
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('fullscreenerror', () => {
    feedback.textContent = blockedMessage();
    sync();
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    feedback.textContent = '';
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        if (!document.documentElement.requestFullscreen) {
          feedback.textContent = 'Tela cheia indisponível neste navegador. Use as opções do navegador.';
          return;
        }
        await document.documentElement.requestFullscreen();
        // Alguns navegadores móveis só permitem travar orientação após entrar em tela cheia.
        // Em outros (ex.: Safari) não há API: o aviso em retrato pede a rotação manual.
        const orientation = screen.orientation as (ScreenOrientation & {
          lock?: (mode: 'landscape') => Promise<void>;
        }) | undefined;
        try { await orientation?.lock?.('landscape'); } catch { /* rotação manual continua disponível */ }
      }
    } catch {
      feedback.textContent = blockedMessage();
    } finally {
      button.disabled = false;
      sync();
    }
  });
  sync();
}
