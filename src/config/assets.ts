/**
 * Chaves e caminhos dos assets carregados no BootScene.
 * Os caminhos são relativos a public/ (o Vite serve essa pasta na raiz).
 */

/** Ordem canônica das direções: é a ordem das linhas dos atlas do personagem. */
export const DIRECTIONS = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
] as const;

export type Direction = (typeof DIRECTIONS)[number];

/** Tamanho de uma célula de sprite do personagem e de um tile do chão. */
export const CELL_SIZE = 64;

/** Frames de walk por direção (6 frames por direção, uma linha por direção). */
export const WALK_FRAMES_PER_DIRECTION = 6;

export const KEYS = {
  groundTiles: 'ground-tiles',
  fangYuanWalk: 'fang-yuan-walk',
  fangYuanIdle: 'fang-yuan-idle',
} as const;

export const PATHS = {
  groundTiles: 'assets/tilesets/free-asset-pack/ground-atlas-64.png',
  fangYuanWalk: 'assets/characters/fang-yuan/assets/walk/fang-yuan-walk-8dir-6frames.png',
  fangYuanIdle: 'assets/characters/fang-yuan/assets/idle/fang-yuan-idle-8dir-1frame.png',
} as const;
