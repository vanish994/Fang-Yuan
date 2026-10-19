import type { Direction } from '../combat/types';

/** Linhas do manifesto enviado; a ordem do elenco no mapa é diferente. */
export const NPC_ROWS: Readonly<Record<string, number>> = {
  'npc-gu-yue-mei': 0,
  'npc-zhao-he': 1,
  'npc-old-chen': 2,
  'npc-lin-shan': 3,
  'npc-gu-yue-lan': 4,
  'npc-gu-yue-fang': 5,
  'npc-aunt-hua': 6,
  'npc-gu-yue-bo': 7,
  'npc-gu-yue-chi-lian': 8,
  'npc-gu-yue-mo-bei': 9,
};
const COLUMNS: Readonly<Record<Direction, number>> = {
  down: 0, left: 1, up: 2, right: 3,
};

export function npcFrame(id: string, direction: Direction): number {
  const row = NPC_ROWS[id];
  if (row === undefined) throw new Error(`NPC sem sprite: ${id}`);
  return row * 4 + COLUMNS[direction];
}
