/**
 * Constantes globais do jogo (resolução base, cores, etc.).
 * Mantenha aqui valores compartilhados entre cenas para evitar "números mágicos" espalhados.
 */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const COLORS = {
  background: 0x101820,
  accent: 0xf0a500,
  text: '#ffffff',
} as const;

/**
 * Posição e tamanho dos botões de ação na tela de toque (espaço do jogo 1280×720).
 * Ficam no canto inferior direito, na área de alcance do polegar. ATK é o maior.
 */
export const TOUCH_BUTTONS = {
  attack: { x: GAME_WIDTH - 120, y: GAME_HEIGHT - 120, radius: 86 },
  dash: { x: GAME_WIDTH - 290, y: GAME_HEIGHT - 100, radius: 54 },
  skill: { x: GAME_WIDTH - 250, y: GAME_HEIGHT - 250, radius: 54 },
} as const;

export const BUTTON_COLORS = {
  attack: 0xf0a500,
  dash: 0x3ab0ff,
  skill: 0xb86bff,
} as const;
