import type { Spawn } from './initialWorld';

/**
 * Distribuição das criaturas extras de uma área.
 *
 * As posições autorais do mundo continuam sendo a base (elas têm leitura de
 * mapa, clareiras e guardas de chefe). O restante é distribuído em tiles
 * livres por hash determinístico da seed da área: nada de mob dentro de árvore,
 * nada de posição diferente entre duas visitas.
 */
export interface PlacementInput {
  /** Lado da área em tiles (48). */
  tiles: number;
  /** Lado do tile em px (32). Só é usado para testar a colisão. */
  tileSize: number;
  /** Seed da área: mesma seed, mesmas posições. */
  seed: number;
  /** Quantas criaturas extras colocar. */
  extra: number;
  /** Espécies que podem ser duplicadas, em ordem de rodízio (nunca chefes). */
  species: readonly string[];
  /** Colisão em px, exatamente a mesma usada pelo corpo do jogador. */
  isFree: (x: number, y: number) => boolean;
  /** Pontos que não podem receber criatura (px): spawns autorais, NPCs, POIs, entrada. */
  avoid: readonly { x: number; y: number }[];
}

/** Margem junto às bordas: saídas e câmera precisam de espaço. */
export const BORDER_TILES = 3;
/** Distância mínima (Chebyshev, em tiles) entre duas criaturas extras. */
export const MIN_SPAWN_GAP_TILES = 4;
/** Raio de proteção em volta de spawns autorais/NPCs/POIs/entrada. */
export const AVOID_GAP_TILES = 4;

/** Hash estável: ordem de varredura embaralhada pela seed do mapa. */
export function placementRank(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x + 41, 0x9e3779b1) ^ Math.imul(y + 57, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Devolve entre 0 e `extra` criaturas. Se o mapa não tiver tiles livres
 * suficientes com a separação mínima, coloca menos — nunca sobrepõe mobs nem
 * força uma posição bloqueada.
 */
export function placeExtraSpawns(input: PlacementInput): Spawn[] {
  if (input.extra <= 0 || input.species.length === 0) return [];
  const limit = input.tiles - BORDER_TILES;
  const candidates: { x: number; y: number; rank: number }[] = [];
  for (let y = BORDER_TILES; y < limit; y += 1) {
    for (let x = BORDER_TILES; x < limit; x += 1) {
      if (!input.isFree(x * input.tileSize, y * input.tileSize)) continue;
      candidates.push({ x, y, rank: placementRank(input.seed, x, y) });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);

  const avoid = input.avoid.map(point => ({
    x: Math.floor(point.x / input.tileSize), y: Math.floor(point.y / input.tileSize) }));
  const chosen: Spawn[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= input.extra) break;
    if (avoid.some(point => chebyshev(point, candidate) < AVOID_GAP_TILES)) continue;
    if (chosen.some(spawn => chebyshev(spawn, candidate) < MIN_SPAWN_GAP_TILES)) continue;
    const species = input.species[chosen.length % input.species.length]!;
    chosen.push({
      // Id estável entre visitas: a cena usa a chave `area:id` para saber qual
      // spawn morreu e agendar o respawn. Cada renascimento ganha um sufixo
      // (`~2`, `~3`) e vira uma instância nova no motor.
      id: `${species}-extra-${chosen.length + 1}`,
      speciesId: species, x: candidate.x, y: candidate.y, density: 'isolated',
    });
  }
  return chosen;
}
