/**
 * Vila Inicial da Montanha: mapa em dados puros (sem Phaser), testável sem navegador.
 *
 * Camada de chão e relevo. O layout (alturas e superfície) está em `baseLayout.ts`.
 * A partir dele, este módulo deriva:
 *   - paredes: célula mais baixa que encosta (inclusive na diagonal) em um patamar mais alto
 *     vira parede (bloqueada). A parede fica no lado de baixo, como um penhasco.
 *     Na diagonal, é para fechar os cantos sem buracos.
 *   - arte da parede: o penhasco de frente (grama em cima) girado para o lado do patamar;
 *   - escadas ("S"): células caminháveis que ligam dois níveis (sem parede);
 *   - colisões: os retângulos das paredes.
 *
 * Camadas do mapa:
 *   ground   (depth 0)   : grama e terra da praça (atlas base-tiles-64)
 *   overlay  (depth 0.2) : paredes, escadas e trilhas (mesmo atlas)
 * Não há objetos (images/decor) nesta etapa.
 */
import { BASE_HEIGHTS, BASE_SURFACE } from './baseLayout';
import { FEUDAL_PROPS, HARMONIOUS_SHEETS, LAKE_WATER_TILE } from './assetCatalog';

export const TILE = 64;
export const MAP_COLS = 60;
export const MAP_ROWS = 44;

/**
 * Índices do atlas base-tiles-64.png (8 colunas de 64 px). Gerado por scripts/build-base-layer.py.
 * Penhascos: 12-17 (grama em cima, patamar ao norte); 34-39 girado (patamar a leste);
 * 40-45 girado (patamar a oeste); 46-51 girado 180 (patamar ao sul).
 */
export const BASE_TILE = {
  GRASS: [0, 1, 2, 4, 5],
  FLOWER: 3,
  DIRT: [6, 7],
  WALL_FROM_NORTH: [12, 13, 14, 15, 16, 17],
  WALL_FROM_EAST: [34, 35, 36, 37, 38, 39],
  WALL_FROM_WEST: [40, 41, 42, 43, 44, 45],
  WALL_FROM_SOUTH: [46, 47, 48, 49, 50, 51],
  STAIRS: [18, 19],
  PATH_VERTICAL: 20,
} as const;

/** Texturas de imagens inteiras (platô e lago). Carregadas para uso futuro. */
export const PLATEAU_IMAGE = {
  key: 'hm-plateau',
  file: 'assets/tilesets/harmonious-seasons/Cliffs/Cliffs_Grass.png',
} as const;
export const POND_IMAGE = {
  key: 'hm-pond',
  file: 'assets/tilesets/harmonious-seasons/Water/WaterEdges/Deep_Water_Grass.png',
} as const;
export const LAKE_KEY = 'hm-lake';
export const LAKE_FRAME = 'lake-water';

/** Ponto de partida do personagem, em tiles (x, y). */
const SPAWN_TILE = { x: 30.5, y: 13.5 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageItem {
  texture: string;
  frame?: string;
  x: number;
  y: number;
  scale: number;
  depth: number;
}

export interface Decor {
  texture: string;
  frame?: string;
  /** Base do objeto (centro inferior), em px do mundo. */
  x: number;
  y: number;
  /** Tamanho exibido, em px. */
  w: number;
  h: number;
  /** Chão: desenhado sob o personagem e sem ordenação por y. */
  flat: boolean;
  /** Retângulos sólidos deste objeto (px). */
  blockers: Rect[];
}

export interface VillageMap {
  cols: number;
  rows: number;
  /** Índices do atlas base, uma linha por tile. -1 é vazio. */
  ground: number[][];
  /** Índices do atlas base para a camada por cima do chão; -1 é vazio. */
  overlay: number[][];
  images: ImageItem[];
  decor: Decor[];
  /** Sólidos de tile (paredes), em px. */
  tileSolids: Rect[];
  /** Todos os sólidos para colisão. */
  solids: Rect[];
  spawn: { x: number; y: number };
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Gerador pseudoaleatório determinístico (mulberry32). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridOf<T>(rows: number, cols: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array<T>(cols).fill(fill));
}

/** Junta retângulos contíguos com a mesma linha (y e h). */
function mergeRows(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.h - b.h || a.x - b.x);
  const out: Rect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.y === r.y && last.h === r.h && last.x + last.w === r.x) {
      last.w += r.w;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Construção                                                          */
/* ------------------------------------------------------------------ */

/** Vizinhança de 8 (ordem: ortogonais primeiro, para escolher a arte da parede). */
const NEIGHBORS_8: Array<[number, number]> = [
  [0, -1], [0, 1], [1, 0], [-1, 0],
  [1, -1], [-1, -1], [1, 1], [-1, 1],
];

export function buildVillageMap(): VillageMap {
  const rows = BASE_HEIGHTS.length;
  const cols = BASE_HEIGHTS[0]!.length;
  if (rows !== MAP_ROWS || cols !== MAP_COLS) {
    throw new Error(`Layout base tem ${cols}x${rows}, esperado ${MAP_COLS}x${MAP_ROWS}.`);
  }
  if (BASE_SURFACE.length !== rows || BASE_SURFACE.some((r) => r.length !== cols)) {
    throw new Error('BASE_SURFACE não tem o mesmo tamanho de BASE_HEIGHTS.');
  }
  const H = BASE_HEIGHTS.map((r) => [...r].map(Number));
  const S = BASE_SURFACE.map((r) => [...r]);
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cols && y < rows;
  const isStairs = (x: number, y: number): boolean => S[y]![x] === 'S';

  // 1) Paredes: de cima para baixo. Uma célula (não escada) vira parede se encosta, na vizinhança de 8,
  //    em uma célula de altura maior que não é parede. Assim a parede é o penhasco do lado de baixo.
  const wall = gridOf(rows, cols, false);
  const levels = [...new Set(H.flat())].sort((a, b) => b - a);
  for (const k of levels) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (H[y]![x] !== k || isStairs(x, y)) continue;
        for (const [dx, dy] of NEIGHBORS_8) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inside(nx, ny) || isStairs(nx, ny)) continue;
          if (H[ny]![nx]! > k && !wall[ny]![nx]) {
            wall[y]![x] = true;
            break;
          }
        }
      }
    }
  }
  const walkable = (x: number, y: number): boolean => inside(x, y) && !wall[y]![x];

  // 2) Escadas: célula caminhável em cima e embaixo, de alturas diferentes.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isStairs(x, y)) continue;
      if (!walkable(x, y - 1) || !walkable(x, y + 1) || isStairs(x, y - 1) || isStairs(x, y + 1)) {
        throw new Error(`Escada em (${x}, ${y}) sem caminho em cima e embaixo.`);
      }
      if (H[y - 1]![x] === H[y + 1]![x]) {
        throw new Error(`Escada em (${x}, ${y}) liga dois pontos da mesma altura.`);
      }
    }
  }

  // 3) Sem desnível: duas células caminháveis vizinhas (não escada) precisam ter a mesma altura.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!walkable(x, y) || isStairs(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!walkable(nx, ny) || isStairs(nx, ny)) continue;
        if (H[ny]![nx] !== H[y]![x]) {
          throw new Error(`Desnível sem parede entre (${x}, ${y}) e (${nx}, ${ny}).`);
        }
      }
    }
  }

  // 4) Trilhas: só verticais por enquanto (há um único tile de trilha vertical no atlas).
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (S[y]![x] !== 'p') continue;
      if (!walkable(x, y)) throw new Error(`Trilha em (${x}, ${y}) cai sobre parede.`);
      if (S[y]![x - 1] === 'p' || S[y]![x + 1] === 'p') {
        throw new Error(`Trilha horizontal em (${x}, ${y}): ainda não há tile para ela.`);
      }
    }
  }

  // 5) Arte e colisão.
  const rng = makeRng(2024);
  const ground = gridOf(rows, cols, -1);
  const overlay = gridOf(rows, cols, -1);
  const solids: Rect[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (S[y]![x] === 'c') {
        ground[y]![x] = BASE_TILE.DIRT[rng() < 0.75 ? 0 : 1]!;
      } else {
        const r = rng();
        ground[y]![x] = r < 0.06 ? BASE_TILE.FLOWER : BASE_TILE.GRASS[Math.floor(rng() * BASE_TILE.GRASS.length)]!;
      }
      if (wall[y]![x]) {
        const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
        // Lado do patamar: ortogonal primeiro, depois diagonal pela componente vertical.
        let side: 'N' | 'S' | 'E' | 'W' = 'N';
        for (const [dx, dy] of NEIGHBORS_8) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inside(nx, ny) || isStairs(nx, ny) || H[ny]![nx]! <= H[y]![x]! || wall[ny]![nx]) continue;
          if (dx === 0) { side = dy < 0 ? 'N' : 'S'; break; }
          if (dy === 0) { side = dx > 0 ? 'E' : 'W'; break; }
          side = dy < 0 ? 'N' : 'S';
          break;
        }
        const set = side === 'N' ? BASE_TILE.WALL_FROM_NORTH
          : side === 'S' ? BASE_TILE.WALL_FROM_SOUTH
          : side === 'E' ? BASE_TILE.WALL_FROM_EAST
          : BASE_TILE.WALL_FROM_WEST;
        overlay[y]![x] = pick(set);
        solids.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
      } else if (S[y]![x] === 'S') {
        overlay[y]![x] = BASE_TILE.STAIRS[Math.floor(rng() * BASE_TILE.STAIRS.length)]!;
      } else if (S[y]![x] === 'p') {
        overlay[y]![x] = BASE_TILE.PATH_VERTICAL;
      }
    }
  }
  const tileSolids = mergeRows(solids);

  const spawn = { x: SPAWN_TILE.x * TILE, y: SPAWN_TILE.y * TILE };
  const playerBox: Rect = { x: spawn.x - 12, y: spawn.y + 13, w: 24, h: 24 };
  for (const s of tileSolids) {
    if (playerBox.x < s.x + s.w && s.x < playerBox.x + playerBox.w && playerBox.y < s.y + s.h && s.y < playerBox.y + playerBox.h) {
      throw new Error('O ponto de partida está bloqueado.');
    }
  }

  return {
    cols,
    rows,
    ground,
    overlay,
    images: [],
    decor: [],
    tileSolids,
    solids: tileSolids,
    spawn,
  };
}

/** Lista de textures necessárias (para o BootScene). */
export function villageTextureFiles(): Array<{ key: string; file: string }> {
  const out: Array<{ key: string; file: string }> = [];
  for (const s of HARMONIOUS_SHEETS) out.push({ key: s.key, file: s.file });
  out.push({ key: LAKE_KEY, file: LAKE_WATER_TILE.file });
  out.push({ key: PLATEAU_IMAGE.key, file: PLATEAU_IMAGE.file });
  out.push({ key: POND_IMAGE.key, file: POND_IMAGE.file });
  for (const [name, prop] of Object.entries(FEUDAL_PROPS)) out.push({ key: `vil-${name}`, file: prop.file });
  return out;
}
