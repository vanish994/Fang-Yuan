import type { Direction, Point } from './types';

/** Vetores cardeais compartilhados pelo motor de combate e pelas habilidades. */
export const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Direção cardeal que mais se aproxima da reta entre dois pontos. */
export function dominantDirection(from: Point, to: Point): Direction {
  const dx = to.x - from.x, dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
}

/**
 * Distância livre percorrível a partir de `origin`, em passos de 4 px, até
 * `wanted`. Para no primeiro obstáculo: uma habilidade nunca atravessa parede.
 */
export function travelFrom(origin: Point, direction: Direction, wanted: number,
  isFree: (x: number, y: number) => boolean): number {
  const v = vectors[direction];
  let traveled = 0;
  for (let d = 4; d <= wanted; d += 4) {
    if (!isFree(origin.x + v.x * d, origin.y + v.y * d)) break;
    traveled = d;
  }
  return traveled;
}
