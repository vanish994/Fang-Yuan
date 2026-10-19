import type { GeneratedArea } from '../world/areaGenerator';
import type { Side } from '../world/initialWorld';

/** Representação esquemática da área ativa. Não inventa tiles ou revela outras áreas. */
export const MINIMAP_CELL = {
  grass: 0, trees: 1, trail: 2, stone: 3, water: 4, blocked: 5, exit: 6,
} as const;
export type MinimapCell = typeof MINIMAP_CELL[keyof typeof MINIMAP_CELL];
export interface MinimapSnapshot { readonly size: number; readonly cells: Uint8Array }

export function buildMinimapSnapshot(area: GeneratedArea): MinimapSnapshot {
  const size = area.collision.length;
  const cells = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    cells[index] = area.layers.TERRAIN[y]?.[x] !== -1 ? MINIMAP_CELL.water
      : area.layers.STRUCTURES[y]?.[x] !== -1 ? MINIMAP_CELL.stone
        : area.layers.PATHS[y]?.[x] !== -1 || area.layers.TERRAIN_TRANSITIONS[y]?.[x] !== -1
          ? MINIMAP_CELL.trail : area.collision[y]?.[x] ? MINIMAP_CELL.blocked : MINIMAP_CELL.grass;
  }
  // A copa é só representação visual: colisão permanece definida pelo gerador, não pelo minimapa.
  for (const object of area.scenery) {
    if (object.atlas !== 'forest-trees' && object.atlas !== 'rocks') continue;
    const color = object.atlas === 'forest-trees' ? MINIMAP_CELL.trees : MINIMAP_CELL.stone;
    for (let dy = 0; dy < object.height / 32; dy++) for (let dx = 0; dx < object.width / 32; dx++) {
      const x = object.x / 32 + dx, y = object.y / 32 + dy;
      if (x >= 0 && y >= 0 && x < size && y < size && cells[y * size + x] === MINIMAP_CELL.grass)
        cells[y * size + x] = color;
    }
  }
  for (const side of Object.keys(area.definition.exits) as Side[]) {
    for (let offset = -1; offset <= 1; offset++) {
      const x = side === 'west' ? 0 : side === 'east' ? size - 1 : Math.floor(size / 2) + offset;
      const y = side === 'north' ? 0 : side === 'south' ? size - 1 : Math.floor(size / 2) + offset;
      cells[y * size + x] = MINIMAP_CELL.exit;
    }
  }
  return { size, cells };
}

/** Posição relativa ao mapa local, nunca ao mundo inteiro; clampa para não desenhar fora do quadro. */
export function minimapPosition(worldX: number, worldY: number, size: number, pixelSize = 96):
  Readonly<{ x: number; y: number }> {
  const limit = size * 32;
  const scale = (value: number) => Math.max(2, Math.min(pixelSize - 3,
    Math.floor((Number.isFinite(value) ? value : 0) / limit * pixelSize)));
  return { x: scale(worldX), y: scale(worldY) };
}
