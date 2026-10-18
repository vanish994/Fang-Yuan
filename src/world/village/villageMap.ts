/**
 * Vila Inicial da Montanha: mapa em dados puros (sem Phaser), testável sem navegador.
 *
 * Camada de chão e relevo. O layout (alturas e superfície) está em `baseLayout.ts`.
 * A partir dele, este módulo deriva:
 *   - penhascos: célula mais baixa logo abaixo de uma célula mais alta vira penhasco (bloqueado);
 *   - escadas: células "S" que substituem o penhasco (caminháveis);
 *   - paredes: nas bordas laterais e superiores entre níveis, uma faixa fina bloqueia a célula mais alta;
 *   - colisões: os retângulos dos penhascos e das paredes.
 *
 * Camadas do mapa:
 *   ground   (depth 0)   : grama e terra da praça (atlas base-tiles-64)
 *   overlay  (depth 0.2) : penhascos, escadas e trilhas (mesmo atlas)
 * Não há objetos (images/decor) nesta etapa.
 */
import { BASE_HEIGHTS, BASE_SURFACE } from './baseLayout';
import { FEUDAL_PROPS, HARMONIOUS_SHEETS, LAKE_WATER_TILE } from './assetCatalog';

export const TILE = 64;
export const MAP_COLS = 60;
export const MAP_ROWS = 44;

/** Índices do atlas base-tiles-64.png (8 colunas de 64 px). Ver scripts/build-base-layer.py. */
export const BASE_TILE = {
  GRASS: [0, 1, 2, 4, 5],
  FLOWER: 3,
  DIRT: [6, 7],
  FACE: [12, 13, 14, 15, 16, 17],
  STAIRS: [18, 19],
  PATH_VERTICAL: 20,
} as const;

/** Espessura da faixa de parede (px), dentro da célula mais alta. */
const WALL = 12;

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
  /** Sólidos de tile (penhascos e paredes), em px. */
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

/** Junta retângulos contíguos com a mesma linha (y e h) e o mesmo tamanho de faixa. */
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

  // 1) Penhascos: célula logo abaixo de uma célula mais alta vira penhasco (exceto escada).
  const face = gridOf(rows, cols, false);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isStairs(x, y)) continue;
      if (!inside(x, y + 1)) continue;
      if (H[y + 1]![x]! < H[y]![x]! && !isStairs(x, y + 1)) face[y + 1]![x] = true;
    }
  }
  const walkable = (x: number, y: number): boolean => inside(x, y) && !face[y]![x];

  // 2) Escadas: precisam de célula caminhável em cima e embaixo, com alturas diferentes.
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

  // 3) Trilhas: só verticais por enquanto (há um único tile de trilha vertical no atlas).
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (S[y]![x] !== 'p') continue;
      if (!walkable(x, y)) throw new Error(`Trilha em (${x}, ${y}) cai sobre penhasco.`);
      if (S[y]![x - 1] === 'p' || S[y]![x + 1] === 'p') {
        throw new Error(`Trilha horizontal em (${x}, ${y}): ainda não há tile para ela.`);
      }
    }
  }

  // 4) Paredes: entre duas células caminháveis de alturas diferentes, a mais alta ganha uma faixa.
  const solids: Rect[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (face[y]![x]) {
        solids.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
        continue;
      }
      if (isStairs(x, y) || !walkable(x, y)) continue;
      const h = H[y]![x]!;
      const edges: Array<[number, number, 'N' | 'S' | 'E' | 'W']> = [
        [0, -1, 'N'],
        [0, 1, 'S'],
        [-1, 0, 'W'],
        [1, 0, 'E'],
      ];
      for (const [dx, dy, side] of edges) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || !walkable(nx, ny) || isStairs(nx, ny)) continue;
        if (H[ny]![nx]! >= h) continue;
        const px = x * TILE;
        const py = y * TILE;
        if (side === 'N') solids.push({ x: px, y: py, w: TILE, h: WALL });
        if (side === 'S') solids.push({ x: px, y: py + TILE - WALL, w: TILE, h: WALL });
        if (side === 'W') solids.push({ x: px, y: py, w: WALL, h: TILE });
        if (side === 'E') solids.push({ x: px + TILE - WALL, y: py, w: WALL, h: TILE });
      }
    }
  }
  const tileSolids = mergeRows(solids);

  // 5) Arte: chão (grama e terra da praça), e por cima penhascos, escadas e trilhas.
  const rng = makeRng(2024);
  const ground = gridOf(rows, cols, -1);
  const overlay = gridOf(rows, cols, -1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (S[y]![x] === 'c') {
        ground[y]![x] = BASE_TILE.DIRT[rng() < 0.75 ? 0 : 1]!;
      } else {
        const r = rng();
        ground[y]![x] = r < 0.06 ? BASE_TILE.FLOWER : BASE_TILE.GRASS[Math.floor(rng() * BASE_TILE.GRASS.length)]!;
      }
      if (face[y]![x]) {
        overlay[y]![x] = BASE_TILE.FACE[Math.floor(rng() * BASE_TILE.FACE.length)]!;
      } else if (S[y]![x] === 'S') {
        overlay[y]![x] = BASE_TILE.STAIRS[Math.floor(rng() * BASE_TILE.STAIRS.length)]!;
      } else if (S[y]![x] === 'p') {
        overlay[y]![x] = BASE_TILE.PATH_VERTICAL;
      }
    }
  }

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
