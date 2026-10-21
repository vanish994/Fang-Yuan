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

/**
 * Usa os quadros reais do Ground Mixel; o atlas é opaco, logo a transição substitui a célula.
 *
 * A gramática foi medida quadro a quadro: cada quadro toca a borda da célula exatamente nos
 * lados onde a terra continua (a grama aparece só do lado do vizinho de grama). Por isso o
 * quadro correto é o que casa com a máscara de vizinhos — nada de cantos inventados.
 * Corredores de 1 célula (vizinhas opostas de terra) têm peças próprias com faixa fina de grama.
 */
export function dirtFrame(mask: readonly (readonly boolean[])[], x: number, y: number): number {
  const at = (dx: number, dy: number) => inside(x + dx, y + dy) && !!mask[y + dy]?.[x + dx];
  const n = at(0, -1), s = at(0, 1), w = at(-1, 0), e = at(1, 0);
  const sides = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);
  if (sides === 4) return 10; // miolo: terra lisa, sem cunhas de grama
  if (sides === 3) {
    // Encosta larga: faixa fina de grama só do lado sem terra (76/77/72/84).
    if (!w) return 76;
    if (!e) return 77;
    if (!n) return 72;
    return 84;
  }
  if (sides === 2) {
    // Opostas: corredor de 1 célula (48/50). Adjacentes: quina arredondada 42/43/30/31.
    if (n && s) return 50; // terra em cima e embaixo: corredor em pé, grama dos lados
    if (e && w) return 48; // terra nos lados: corredor deitado, grama em cima e embaixo
    if (e && s) return 43;
    if (s && w) return 42;
    if (n && e) return 31;
    return 30;
  }
  if (sides === 0) return 44; // mancha isolada cercada de grama
  // Ponta de trilha: meia célula de grama do lado oposto.
  if (n) return 37;
  if (s) return 25;
  if (e) return 24;
  return 27;
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
  const pathTo = (x: number, y: number, width = 0) => {
    const steps = Math.max(Math.abs(x - 24), Math.abs(y - 24)) * 3;
    let last: readonly [number, number] | undefined;
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
      // Trilha de 1 célula: preenche o cotovelo para o traçado não ficar só com quinas.
      if (width === 0 && last && last[0] !== px && last[1] !== py) {
        const elbow = Math.abs(px - last[0]) > Math.abs(py - last[1]) ? [last[0], py] : [px, last[1]];
        if (inside(elbow[0]!, elbow[1]!)) {
          dirt[elbow[1]!]![elbow[0]!] = true;
          protectedCell[elbow[1]!]![elbow[0]!] = true;
          collision[elbow[1]!]![elbow[0]!] = false;
        }
      }
      last = [px, py];
    }
  };
  for (const side of Object.keys(definition.exits) as Side[]) {
    const [x, y] = gate(side);
    pathTo(x, y);
    // Abertura de 3 células até o limite da área; antes a boca de 7×5 virava um
    // grande retângulo de terra solto na borda do mapa.
    for (let i = -1; i <= 1; i++) for (let j = 0; j <= 2; j++) {
      const xx = side === 'west' ? j : side === 'east' ? AREA_TILES - 1 - j : x + i;
      const yy = side === 'north' ? j : side === 'south' ? AREA_TILES - 1 - j : y + i;
      if (inside(xx, yy)) { dirt[yy]![xx] = true; protectedCell[yy]![xx] = true; collision[yy]![xx] = false; }
    }
  }
  for (const place of [...definition.pointsOfInterest, ...definition.mobSpawns])
    pathTo(Math.round(place.x), Math.round(place.y));

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
  // Lagoa fechada: mosaico 6×4 com orla de grama, montado com o autotile de água do pacote
  // (52/53 quinas de cima, 50/51 margem norte, 48/49 margens, 62/63 margem sul, 66/67 quinas
  // de baixo, 71 água limpa). A versão anterior usava só 0–3 e 12–15 e deixava a água
  // vazando sem borda nas laterais.
  if (definition.id === 'floresta_exterior' || definition.id === 'ninho_serpente') {
    const lake: readonly (readonly number[])[] = [
      [52, 50, 51, 51, 50, 53],
      [48, 71, 71, 71, 71, 49],
      [48, 71, 71, 71, 71, 49],
      [66, 62, 63, 63, 62, 67],
    ];
    const left = 33, top = 35;
    for (let dy = 0; dy < lake.length; dy++) for (let dx = 0; dx < lake[dy]!.length; dx++) {
      const x = left + dx, y = top + dy;
      if (!inside(x, y)) continue;
      layers.TERRAIN[y]![x] = lake[dy]![dx]!;
      collision[y]![x] = true; protectedCell[y]![x] = true; dirt[y]![x] = false;
    }
    // Uma célula de folga em volta evita árvore/pedra encostada na orla.
    for (let dy = -1; dy <= lake.length; dy++) for (let dx = -1; dx <= lake[0]!.length; dx++)
      if (inside(left + dx, top + dy)) protectedCell[top + dy]![left + dx] = true;
  }

  // Fecha buracos de grama de 1 célula cercados de terra nos quatro lados: a camada de
  // grama não tem transição e a célula aparecia como um quadrado liso no meio da trilha.
  for (let y = 1; y < AREA_TILES - 1; y++) for (let x = 1; x < AREA_TILES - 1; x++) {
    if (dirt[y]![x] || layers.STRUCTURES[y]![x] !== -1 || layers.TERRAIN[y]![x] !== -1) continue;
    const dirtSides = Number(dirt[y - 1]![x]) + Number(dirt[y + 1]![x])
      + Number(dirt[y]![x - 1]) + Number(dirt[y]![x + 1]);
    if (dirtSides === 4) {
      dirt[y]![x] = true;
      protectedCell[y]![x] = true;
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
    for (let dy = 0; dy < tiles.h; dy++) for (let dx = 0; dx < tiles.w; dx++) {
      // Copas cortadas na borda e árvores em cima da trilha eram a deformidade mais visível.
      if (!inside(x + dx, y + dy) || x + dx < 2 || y + dy < 2
        || x + dx > AREA_TILES - 3 || y + dy > AREA_TILES - 3) blocked = true;
      else if (protectedCell[y + dy]?.[x + dx] || layers.STRUCTURES[y + dy]?.[x + dx] !== -1
        || dirt[y + dy]?.[x + dx] || layers.TERRAIN[y + dy]?.[x + dx] !== -1) blocked = true;
    }
    if (blocked) continue;
    scenery.push({ atlas: tiles.atlas, x: x * 32, y: y * 32, width: tiles.fw,
      height: tiles.fh, frameX: tiles.fx, frameY: 0, depthY: (y + tiles.h) * 32 });
    const footX = x + Math.floor(tiles.w / 2), footY = y + tiles.h - 1;
    collision[footY]![footX] = true;
    protectedCell[footY]![footX] = true;
    }
  }
  for (let y = 4; y < AREA_TILES - 4; y += 3) for (let x = 4; x < AREA_TILES - 4; x += 3) {
    // Detalhe solto no meio da trilha quebrava a leitura do caminho.
    if (protectedCell[y]![x] || collision[y]![x] || dirt[y]![x]) continue;
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
