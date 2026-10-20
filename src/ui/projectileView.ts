import type { Direction } from '../combat/types';

/**
 * Geometria e pooling dos projéteis, separados do Phaser.
 *
 * O jogador e as criaturas têm aparências diferentes (lâmina em meia-lua vs.
 * orbe), mas o posicionamento, a rotação e o reaproveitamento de objetos são
 * iguais — antes isso estava duplicado em dois blocos quase idênticos.
 */

/** Rotação em radianos para uma direção cardinal; 0 aponta para a direita. */
export function directionRotation(direction: Direction): number {
  switch (direction) {
    case 'right': return 0;
    case 'left': return Math.PI;
    case 'up': return -Math.PI / 2;
    case 'down': return Math.PI / 2;
  }
}

/** Converte a cor `#rrggbb` do catálogo no inteiro usado pelo Phaser. */
export function guColor(color: string): number {
  const parsed = Number.parseInt(color.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

export interface ProjectilePlacement { x: number; y: number; rotation: number }

export function placementOf(shot: { x: number; y: number; direction: Direction }): ProjectilePlacement {
  return { x: shot.x, y: shot.y, rotation: directionRotation(shot.direction) };
}

/**
 * Ajusta o pool de objetos para exatamente `count` elementos, criando ou
 * destruindo apenas a diferença. Mantém a ordem: o item i do pool corresponde
 * ao projétil i.
 */
export function syncPool<T>(pool: T[], count: number,
  create: () => T, destroy: (item: T) => void): T[] {
  while (pool.length > count) {
    const removed = pool.pop();
    if (removed !== undefined) destroy(removed);
  }
  while (pool.length < count) pool.push(create());
  return pool;
}

/**
 * Projétil do jogador: lâmina em meia-lua. A largura define o raio externo e
 * a espessura acompanha o Gu equipado.
 */
export interface BladeShape { radius: number; inner: number }

export function bladeShape(width: number): BladeShape {
  const radius = Math.max(4, width / 2);
  return { radius, inner: Math.max(5, radius - 4) };
}

/**
 * Projétil de criatura: orbe com halo escuro e contorno claro, para não ser
 * confundido com a lâmina do jogador nem com o fundo.
 */
export interface OrbShape { halo: number; core: number; ring: number }

export function orbShape(): OrbShape {
  return { halo: 7, core: 4.5, ring: 6.5 };
}
