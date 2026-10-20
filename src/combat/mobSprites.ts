import type { Direction } from './types';

/** Manifesto recebido: 15 linhas; as três finais são arte reservada, sem spawn/atributos definidos. */
export const MOB_ROWS: Readonly<Record<string, number>> = {
  'mob-wild-boar': 0,
  'mob-moon-rabbit': 1,
  'mob-grey-wolf': 2,
  'mob-mountain-monkey': 3,
  'mob-green-snake': 4,
  'mob-fierce-wolf': 5,
  'mob-demonic-boar': 6,
  'mob-black-fang-snake': 7,
  'mob-shadow-spider': 8,
  'mob-stone-lizard': 9,
  'mob-demon-wolf': 10,
  'mob-demon-bear': 11,
  'mob-jade-serpent': 12,
  'mob-demon-tiger': 13,
  'mob-boar-king': 14, // Rei Javali do atlas de mobs ≠ boss Rei Javali Demoníaco.
};
const COLUMNS: Readonly<Record<Direction, number>> = {
  down: 0, left: 1, up: 2, right: 3,
};

export function mobFrame(id: string, direction: Direction): number {
  const row = MOB_ROWS[id];
  if (row === undefined) throw new Error(`Mob sem sprite: ${id}`);
  return row * 4 + COLUMNS[direction];
}
