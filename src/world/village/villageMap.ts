/**
 * Vila Inicial da Montanha: mapa em dados puros (sem Phaser).
 *
 * Estado atual: MAPA EM BRANCO. Não há tiles, objetos nem colisões. Só ficaram o tamanho do
 * mapa (grid de 64 px), o ponto de partida e as listas de texturas (`villageTextureFiles`),
 * que continuam carregadas para montar o mapa aos poucos. A versão gerada por procedimento
 * está no histórico do git (antes deste commit, `buildVillageMap` gerava chão, platô, lago,
 * casas, árvores e colisões).
 *
 * Camadas (quando forem preenchidas), de baixo para cima:
 *   ground   (depth 0)    : chão base (ground-atlas-64); -1 é vazio
 *   overlay  (0.2)        : terra por cima do chão; -1 é vazio
 *   images   (0.1–0.15)   : imagens inteiras (platô, lago, água)
 *   flat     (0.5)        : decoração no chão, desenhada sob o personagem
 *   decor    (y da base)  : objetos; ordenados pelo y da base
 *
 * Colisão: `solids` (retângulos em px). Hoje vazio.
 */
import { FEUDAL_PROPS, HARMONIOUS_SHEETS, LAKE_WATER_TILE } from './assetCatalog';

export const TILE = 64;
export const MAP_COLS = 60;
export const MAP_ROWS = 44;

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

/** Ponto de partida do personagem, em tiles (x, y). Mantido do mapa anterior. */
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
  /** Índices do ground-atlas, uma linha por tile. -1 é vazio. */
  ground: number[][];
  /** Índices do ground-atlas para a camada por cima do chão; -1 é vazio. */
  overlay: number[][];
  images: ImageItem[];
  decor: Decor[];
  /** Sólidos de tile (falésia, água). Vazio no mapa em branco. */
  tileSolids: Rect[];
  /** Todos os sólidos para colisão. Vazio no mapa em branco. */
  solids: Rect[];
  spawn: { x: number; y: number };
}

function emptyGrid(fill: number): number[][] {
  return Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_COLS).fill(fill));
}

/** Mapa em branco: tamanho e ponto de partida, sem tiles, objetos nem colisões. */
export function buildVillageMap(): VillageMap {
  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    ground: emptyGrid(-1),
    overlay: emptyGrid(-1),
    images: [],
    decor: [],
    tileSolids: [],
    solids: [],
    spawn: { x: SPAWN_TILE.x * TILE, y: SPAWN_TILE.y * TILE },
  };
}

/** Lista de textures de Harmonious e Feudal necessárias (para o BootScene). */
export function villageTextureFiles(): Array<{ key: string; file: string }> {
  const out: Array<{ key: string; file: string }> = [];
  for (const s of HARMONIOUS_SHEETS) out.push({ key: s.key, file: s.file });
  out.push({ key: LAKE_KEY, file: LAKE_WATER_TILE.file });
  out.push({ key: PLATEAU_IMAGE.key, file: PLATEAU_IMAGE.file });
  out.push({ key: POND_IMAGE.key, file: POND_IMAGE.file });
  for (const [name, prop] of Object.entries(FEUDAL_PROPS)) out.push({ key: `vil-${name}`, file: prop.file });
  return out;
}
