/** Solo e ocupação da floresta de Qing Mao, contínuos nos 3×3 chunks. */
export const TILE_SIZE = 32;
export const CHUNK_SIZE = 16;
export const AREA_SIZE = 3;
export const TILES_PER_SIDE = CHUNK_SIZE * AREA_SIZE;
export const WORLD_SIZE = TILES_PER_SIDE * TILE_SIZE;

export type GroundLayer = 'base' | 'detail';
export type ChunkGround = Record<GroundLayer, number[][]>;

/** A faixa mínima tem sete tiles (224 px); saliências de 0 a 2 tiles quebram a linha reta. */
export const FOREST_BORDER_TILES = 7;
const inWorld = (x: number, y: number): boolean => Number.isInteger(x) && Number.isInteger(y)
  && x >= 0 && y >= 0 && x < TILES_PER_SIDE && y < TILES_PER_SIDE;

function edgeVariation(position: number, salt: number): number {
  const segment = Math.floor(position / 3);
  return ((Math.imul(segment + salt, 1103515245) >>> 16) % 3);
}

/** Máscara global: nenhum trecho da mata se abre na emenda entre chunks. */
export function isForestTile(x: number, y: number): boolean {
  if (!inWorld(x, y)) return false;
  return x < FOREST_BORDER_TILES + edgeVariation(y, 11)
    || TILES_PER_SIDE - 1 - x < FOREST_BORDER_TILES + edgeVariation(y, 23)
    || y < FOREST_BORDER_TILES + edgeVariation(x, 37)
    || TILES_PER_SIDE - 1 - y < FOREST_BORDER_TILES + edgeVariation(x, 43);
}

/** A navegação nunca entra na mata; o interior permanece livre entre chunks. */
export function isWalkableTile(x: number, y: number): boolean {
  return inWorld(x, y) && !isForestTile(x, y);
}

/** Colisão física de segurança um tile dentro da mata, sem prender o corpo na borda caminhável. */
export function isSolidForestTile(x: number, y: number): boolean {
  // Um anel livre de colisão física ao redor da clareira evita prender a hitbox
  // em cliques próximos às quinas; a máscara de navegação continua fechada.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!isForestTile(x + dx, y + dy)) return false;
    }
  }
  return true;
}

/** Um clique na mata termina na clareira mais próxima; na grama, preserva o pixel tocado. */
export function walkableDestination(x: number, y: number): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)
    || x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return null;
  if (isWalkableTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))) return { x, y };
  let nearest: { x: number; y: number } | null = null;
  let best = Infinity;
  for (let row = 0; row < TILES_PER_SIDE; row++) {
    for (let col = 0; col < TILES_PER_SIDE; col++) {
      if (!isWalkableTile(col, row)) continue;
      const candidate = { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
      const distance = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
      if (distance < best) { best = distance; nearest = candidate; }
    }
  }
  return nearest;
}

export interface ForestTree { x: number; y: number; variant: number }
/** Mosaicos inteiros de 3×4 tiles da seção superior do atlas Mixel, sobrepostos a cada 2 tiles. */
export function buildForestTrees(): ForestTree[] {
  const trees: ForestTree[] = [];
  for (let topY = 0; topY <= TILES_PER_SIDE - 4; topY += 2) {
    for (let leftX = (topY / 2) % 2; leftX <= TILES_PER_SIDE - 3; leftX += 2) {
      let withinForest = true;
      for (let dy = 0; dy < 4 && withinForest; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (!isForestTile(leftX + dx, topY + dy)) { withinForest = false; break; }
        }
      }
      if (!withinForest) continue;
      const seed = (Math.imul(leftX + 19, 73856093) ^ Math.imul(topY + 31, 19349663)) >>> 0;
      trees.push({ x: leftX * TILE_SIZE, y: topY * TILE_SIZE, variant: seed % 3 });
    }
  }
  return trees;
}

export function canTraverseTiles(x: number, y: number, nextX: number, nextY: number): boolean {
  return Math.abs(x - nextX) + Math.abs(y - nextY) === 1
    && isWalkableTile(x, y) && isWalkableTile(nextX, nextY);
}

/** Índices nos dois atlas Mixel (12 colunas): grama lisa e detalhes transparentes. */
export function buildGroundChunk(chunkX: number, chunkY: number): ChunkGround {
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)
    || chunkX < 0 || chunkY < 0 || chunkX >= AREA_SIZE || chunkY >= AREA_SIZE) {
    throw new RangeError(`Chunk fora de Qing Mao: ${chunkX}, ${chunkY}`);
  }

  const chunk: ChunkGround = { base: [], detail: [] };
  for (let row = 0; row < CHUNK_SIZE; row++) {
    const base: number[] = [], detail: number[] = [];
    for (let col = 0; col < CHUNK_SIZE; col++) {
      const x = chunkX * CHUNK_SIZE + col;
      const y = chunkY * CHUNK_SIZE + row;
      // Índice 11 do Ground Tileset: tile 32×32 totalmente opaco de grama.
      base.push(11);
      // Variação leve, fixa no espaço global: não cria emendas entre chunks.
      const seed = (Math.imul(x + 31, 73856093) ^ Math.imul(y + 67, 19349663)) >>> 0;
      detail.push(seed % 100 < 16 ? ((seed >>> 14) & 1) * 12 + ((seed >>> 8) % 7) : -1);
    }
    chunk.base.push(base);
    chunk.detail.push(detail);
  }
  return chunk;
}
