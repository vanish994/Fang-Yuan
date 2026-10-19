import { AREA_TILES, type AreaDefinition, type Side } from './initialWorld';

export const WORLD_LAYERS = ['GROUND', 'TERRAIN', 'TERRAIN_TRANSITIONS', 'PATHS',
  'STRUCTURES', 'DECORATION_BACK', 'OBJECTS', 'DECORATION_FRONT', 'ENTITIES_Y_SORT',
  'COLLISION', 'GAMEPLAY_SPAWN_RESOURCES'] as const;
export type WorldLayer = typeof WORLD_LAYERS[number];
export interface Scenery {
  atlas: 'forest-trees' | 'rocks' | 'bushes' | 'logs' | 'mushrooms';
  x: number; y: number; width: number; height: number; frameX: number; frameY: number;
  /** Apenas tronco/base obstrui. O desenho inteiro pode cobrir um personagem atrás. */
  depthY: number;
}
export interface GeneratedArea {
  definition: AreaDefinition;
  layers: Readonly<Record<WorldLayer, number[][]>>;
  collision: boolean[][];
  scenery: readonly Scenery[];
  isFreeTile(x: number, y: number): boolean;
}
const grid = (fill: number): number[][] => Array.from({ length: AREA_TILES }, () =>
  Array<number>(AREA_TILES).fill(fill));
const hash = (seed: number, x: number, y: number, salt = 0): number => {
  let h = seed ^ Math.imul(x + 41, 0x9e3779b1) ^ Math.imul(y + 57, 0x85ebca6b) ^ salt;
  h = Math.imul(h ^ h >>> 16, 0x7feb352d);
  return (Math.imul(h ^ h >>> 15, 0x846ca68b) ^ h >>> 16) >>> 0;
};
const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < AREA_TILES && y < AREA_TILES;
const gate = (side: Side): readonly [number, number] => side === 'north' ? [24, 0]
  : side === 'south' ? [24, AREA_TILES - 1]
    : side === 'west' ? [0, 24] : [AREA_TILES - 1, 24];

/** Usa os quadros reais do Ground Mixel; o atlas é opaco, logo a transição substitui a célula. */
export function dirtFrame(mask: readonly (readonly boolean[])[], x: number, y: number): number {
  const at = (dx: number, dy: number) => inside(x + dx, y + dy) && !!mask[y + dy]?.[x + dx];
  const n = at(0, -1), s = at(0, 1), w = at(-1, 0), e = at(1, 0);
  if (!n && !w) return 43; // canto sudeste de uma mancha
  if (!n && !e) return 42;
  if (!s && !w) return 31;
  if (!s && !e) return 30;
  if (!n) return 25;
  if (!s) return 37;
  if (!w) return 24;
  if (!e) return 27;
  // Diagonais são avaliadas depois das bordas cardinais: cantos internos.
  if (!at(-1, -1)) return 28;
  if (!at(1, -1)) return 29;
  if (!at(-1, 1)) return 40;
  if (!at(1, 1)) return 41;
  return 10;
}

/** Todos os cálculos são em coordenadas globais da área, independentes do chunk de desenho. */
export function generateArea(definition: AreaDefinition): GeneratedArea {
  if (definition.chunks.width !== 3 || definition.chunks.height !== 3)
    throw new RangeError('Esta campanha usa áreas 3×3 chunks de 16 tiles.');
  const layers = Object.fromEntries(WORLD_LAYERS.map(name => [name, grid(-1)])) as Record<WorldLayer, number[][]>;
  const collision = grid(0).map(row => row.map(() => false));
  const dirt = grid(0).map(row => row.map(() => false));
  const protectedCell = grid(0).map(row => row.map(() => false));
  const scenery: Scenery[] = [];
  for (let y = 0; y < AREA_TILES; y++) for (let x = 0; x < AREA_TILES; x++) {
    layers.GROUND[y]![x] = 11;
    if (x < 2 || y < 2 || x >= AREA_TILES - 2 || y >= AREA_TILES - 2)
      collision[y]![x] = true;
  }
  const protect = (x: number, y: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (inside(Math.floor(x + dx), Math.floor(y + dy))) protectedCell[Math.floor(y + dy)]![Math.floor(x + dx)] = true;
    }
  };
  for (const spawn of [...definition.npcSpawns, ...definition.mobSpawns])
    protect(spawn.x, spawn.y, 2);
  for (const place of definition.pointsOfInterest)
    protect(place.x, place.y, place.kind === 'arena' ? 6 : 2);
  protect(24, 24, 4);
  const pathTo = (x: number, y: number, width = 1) => {
    const steps = Math.max(Math.abs(x - 24), Math.abs(y - 24)) * 3;
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      const bend = Math.min(1.8, Math.max(Math.abs(x - 24), Math.abs(y - 24)) / 9);
      const px = Math.round(24 + (x - 24) * t + Math.sin(t * Math.PI * 2) * bend);
      const py = Math.round(24 + (y - 24) * t + Math.sin(t * Math.PI * 3) * bend);
      for (let dy = -width; dy <= width; dy++) for (let dx = -width; dx <= width; dx++) {
        if (!inside(px + dx, py + dy)) continue;
        if (Math.hypot(dx, dy) <= width + 0.5) {
          dirt[py + dy]![px + dx] = true;
          protectedCell[py + dy]![px + dx] = true;
          collision[py + dy]![px + dx] = false;
        }
      }
    }
  };
  for (const side of Object.keys(definition.exits) as Side[]) {
    const [x, y] = gate(side);
    pathTo(x, y, 1);
    // Apertura legível até o limite da área e chegada protegida na vizinha.
    for (let i = -3; i <= 3; i++) for (let j = 0; j <= 4; j++) {
      const xx = side === 'west' ? j : side === 'east' ? AREA_TILES - 1 - j : x + i;
      const yy = side === 'north' ? j : side === 'south' ? AREA_TILES - 1 - j : y + i;
      if (inside(xx, yy)) { dirt[yy]![xx] = true; protectedCell[yy]![xx] = true; collision[yy]![xx] = false; }
    }
  }
  for (const place of [...definition.pointsOfInterest, ...definition.mobSpawns])
    pathTo(Math.round(place.x), Math.round(place.y), 1);

  if (definition.biome === 'village') {
    // A praça é pequena; as trilhas estreitas deixam gramado e casas visíveis ao redor.
    for (let y = 22; y <= 26; y++) for (let x = 22; x <= 26; x++) {
      dirt[y]![x] = true;
      protectedCell[y]![x] = true;
    }
    // Moradias abertas e rústicas: apenas pedras/paredes existentes do atlas Ruins.
    // Parede frontal tem passagem no meio, sem criar telhado nem inventar portas.
    for (const [left, top, width, height] of [[10, 13, 6, 5], [32, 12, 5, 6],
      [9, 32, 7, 4], [32, 32, 6, 4], [17, 21, 3, 3], [29, 21, 3, 3]] as const) {
      for (let dy = 0; dy <= height; dy++) for (let dx = 0; dx <= width; dx++) {
        const x = left + dx, y = top + dy;
        const wall = (dx === 0 || dx === width || dy === 0 || dy === height)
          && !(dy === height && dx === Math.floor(width / 2));
        if (wall) { layers.STRUCTURES[y]![x] = dy === 0 ? 24 : 36;
          collision[y]![x] = true; dirt[y]![x] = false; }
        else if (dx > 0 && dx < width && dy > 0 && dy < height) {
          dirt[y]![x] = true; collision[y]![x] = false;
        }
      }
    }
  }
  // Os quadros 0–3 e 12–15 do WaterTileset compõem um pequeno lago real de 4×2.
  if (definition.id === 'floresta_exterior' || definition.id === 'ninho_serpente') {
    const left = 35, top = 36;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 4; dx++) {
      const x = left + dx, y = top + dy;
      layers.TERRAIN[y]![x] = dy * 12 + dx;
      collision[y]![x] = true; protectedCell[y]![x] = true; dirt[y]![x] = false;
    }
  }

  for (let y = 0; y < AREA_TILES; y++) for (let x = 0; x < AREA_TILES; x++) {
    if (dirt[y]![x] && layers.TERRAIN[y]![x] === -1 && layers.STRUCTURES[y]![x] === -1) {
      const frame = dirtFrame(dirt, x, y);
      layers[frame === 10 ? 'PATHS' : 'TERRAIN_TRANSITIONS'][y]![x] = frame;
    }
    const v = hash(definition.seed, x, y);
    if (!collision[y]![x] && (dirt[y]![x] ? definition.biome === 'village' && v % 100 < 3 : v % 100 < 13))
      layers.DECORATION_BACK[y]![x] = v % 2 ? 0 : 12;
  }

  const forest = definition.biome === 'forest' || definition.biome === 'dangerous-forest'
    || definition.biome === 'village' || definition.id === 'covil_lobo'
    || definition.id === 'santuario_besta';
  const rocky = definition.biome === 'rocky' || definition.biome === 'cave'
    || definition.id === 'covil_javali' || definition.id === 'ninho_serpente';
  for (let y = 0; y < AREA_TILES - 4; y += 2 + hash(definition.seed, 0, y, 451) % 2) {
    for (let x = hash(definition.seed, 1, y, 811) % 3; x < AREA_TILES - 3;
      x += 2 + hash(definition.seed, x, y, 751) % 4) {
    const roll = hash(definition.seed, x, y, 919) % 100;
    const border = x < 9 || x > 38 || y < 9 || y > 38;
    const cluster = hash(definition.seed, Math.floor(x / 8), Math.floor(y / 8), 2405) % 47 - 23;
    const chance = Math.max(3, Math.min(95, (forest ? border ? definition.biome === 'village' ? 82 : 87 :
      definition.biome === 'dangerous-forest' ? 38 : definition.biome === 'village' ? 7 : 24
      : rocky ? border ? 42 : 24 : 12) + cluster));
    if (roll >= chance) continue;
    const tiles = forest ? { w: 3, h: 4, atlas: 'forest-trees' as const, fw: 96, fh: 128,
      fx: hash(definition.seed, x, y, 31) % 3 * 96 } :
      { w: 2, h: 2, atlas: 'rocks' as const, fw: 64, fh: 64, fx: hash(definition.seed, x, y, 31) % 2 * 64 };
    let blocked = false;
    for (let dy = 0; dy < tiles.h; dy++) for (let dx = 0; dx < tiles.w; dx++)
      if (protectedCell[y + dy]?.[x + dx] || layers.STRUCTURES[y + dy]?.[x + dx] !== -1)
        blocked = true;
    if (blocked) continue;
    scenery.push({ atlas: tiles.atlas, x: x * 32, y: y * 32, width: tiles.fw,
      height: tiles.fh, frameX: tiles.fx, frameY: 0, depthY: (y + tiles.h) * 32 });
    const footX = x + Math.floor(tiles.w / 2), footY = y + tiles.h - 1;
    collision[footY]![footX] = true;
    protectedCell[footY]![footX] = true;
    }
  }
  for (let y = 4; y < AREA_TILES - 4; y += 3) for (let x = 4; x < AREA_TILES - 4; x += 3) {
    if (protectedCell[y]![x] || collision[y]![x]) continue;
    const v = hash(definition.seed, x, y, 1849) % 100;
    if (v >= (definition.biome === 'village' ? 3 : 14)) continue;
    const atlas = rocky ? 'rocks' : v < 2 && definition.resources.includes('logs') ? 'logs'
      : v < 6 ? 'mushrooms' : 'bushes';
    if (atlas === 'rocks' && !definition.resources.includes('rocks')) continue;
    if (atlas === 'mushrooms' && !definition.resources.includes('mushrooms')) continue;
    const width = atlas === 'logs' ? 64 : 32;
    if (atlas === 'logs' && protectedCell[y]?.[x + 1]) continue;
    scenery.push({ atlas, x: x * 32, y: y * 32, width, height: 32,
      frameX: atlas === 'rocks' ? 8 * 32 : atlas === 'bushes' ? 8 * 32 : atlas === 'logs' ? 128 : 0,
      frameY: atlas === 'rocks' ? 2 * 32 : 0, depthY: (y + 1) * 32 });
    if (atlas === 'logs') { collision[y]![x] = true; collision[y]![x + 1] = true; }
  }
  // Navegação e física compartilham esta máscara; decoração não introduz obstáculos invisíveis.
  for (let y = 0; y < AREA_TILES; y++) for (let x = 0; x < AREA_TILES; x++)
    layers.COLLISION[y]![x] = collision[y]![x] ? 11 : -1;
  return { definition, layers, collision, scenery,
    isFreeTile: (x, y) => Number.isInteger(x) && Number.isInteger(y) && inside(x, y) && !collision[y]![x] };
}
