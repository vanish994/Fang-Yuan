import type { Direction } from './types';

/** Manifesto enviado: 4 linhas (bosses) × 4 colunas (baixo, esquerda, cima, direita). */
export const BOSS_ROWS: Readonly<Record<string, number>> = {
  'mob-grey-wolf-king': 0,
  'mob-demonic-boar-king': 1,
  'mob-serpent-king': 2,
  'mob-ancient-demonic-beast': 3,
};
const DIRECTION_COLUMNS: Readonly<Record<Direction, number>> = {
  down: 0, left: 1, up: 2, right: 3,
};

export function bossFrame(id: string, direction: Direction): number {
  const row = BOSS_ROWS[id];
  if (row === undefined) throw new Error(`Boss sem sprite: ${id}`);
  return row * 4 + DIRECTION_COLUMNS[direction];
}
