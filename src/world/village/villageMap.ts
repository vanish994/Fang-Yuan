/**
 * Vila Inicial da Montanha: mapa em dados puros (sem Phaser), para ser testado sem navegador.
 *
 * Grid de 64 px (o mesmo do personagem e do chão). Os sprites do Harmonious Seasons (32 px
 * nativos) são desenhados em escala 2; as peças do Feudal já vêm reduzidas para ~2/3.
 *
 * Camadas, de baixo para cima:
 *   ground   (depth 0)    : chão base (ground-atlas-64), cobre o mapa inteiro
 *   images   (0.1–0.15)   : platô e lago (imagens inteiras), água do lago
 *   overlay  (0.2)        : terra por cima do chão (caminhos, canteiro)
 *   flat     (0.5)        : decoração no chão, desenhada sob o personagem
 *   decor    (y da base)  : árvores, casas, objetos; ordenados pelo y da base
 *
 * Colisão: `solids` (retângulos em px) inclui a falésia, a água e as bases dos objetos.
 */
import {
  FEUDAL_PROPS,
  HARMONIOUS_SHEETS,
  LAKE_WATER_TILE,
  PLATEAU_ROWS,
  POND_ROWS,
  type SheetFrame,
} from './assetCatalog';

export const TILE = 64;
export const MAP_COLS = 60;
export const MAP_ROWS = 44;

/** Escala dos sprites do Harmonious (32 px nativos -> 64 px). */
const HM_SCALE = 2;

/** Texturas do platô e do lago (imagens inteiras do Harmonious). */
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

/** Posições dos terraços da montanha e do lago, em tiles. */
const TERRACES = [
  { col: 15, row: 4 },  // terraço superior: área inicial da vila
  { col: 1, row: 21 },  // terraço inferior: caminho de descida da montanha
] as const;
const PLATEAU_COL = TERRACES[0].col;
const PLATEAU_ROW = TERRACES[0].row;
const POND_COL = 34;
const POND_ROW = 28;

/** Ponto de partida do personagem (centro da praça), em px. */
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
  /** Índices do ground-atlas, uma linha por tile. */
  ground: number[][];
  /** Índices do ground-atlas para a camada por cima do chão; -1 é vazio. */
  overlay: number[][];
  images: ImageItem[];
  decor: Decor[];
  /** Sólidos do mapa (falésia e água), em px. Não inclui as bases dos objetos. */
  tileSolids: Rect[];
  /** Todos os sólidos para colisão: tileSolids + blockers de todos os objetos. */
  solids: Rect[];
  spawn: { x: number; y: number };
  /** Canto superior esquerdo do platô, em tiles (para depuração e testes). */
  plateauCells: { col: number; row: number };
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

function grid<T>(fill: T): T[][] {
  return Array.from({ length: MAP_ROWS }, () => Array<T>(MAP_COLS).fill(fill));
}

function key(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

function plateauChar(tx: number, ty: number): string {
  for (const terrace of TERRACES) {
    const cx = tx - terrace.col;
    const cy = ty - terrace.row;
    const row = PLATEAU_ROWS[cy];
    if (row !== undefined && cx >= 0 && cx < row.length) {
      const char = row[cx] ?? '.';
      if (char !== '.') return char;
    }
  }
  return '.';
}

function pondChar(tx: number, ty: number): string {
  const cx = tx - POND_COL;
  const cy = ty - POND_ROW;
  const row = POND_ROWS[cy];
  if (row === undefined || cx < 0 || cx >= row.length) return '.';
  return row[cx] ?? '.';
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Tiles (col, row) tocados por um retângulo em px. */
function tilesOf(r: Rect): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const c0 = Math.floor(r.x / TILE);
  const c1 = Math.floor((r.x + r.w - 1) / TILE);
  const r0 = Math.floor(r.y / TILE);
  const r1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) out.push([tx, ty]);
  return out;
}

/* ------------------------------------------------------------------ */
/* Peças do Feudal: sólidos da base, por tipo de objeto                 */
/* ------------------------------------------------------------------ */

type BlockKind = 'building' | 'furniture' | 'fence' | 'nature' | 'flat';

function blockKindOf(name: string): BlockKind {
  if (name.startsWith('house-') || name === 'well-stone') return 'building';
  if (name === 'bamboo-fence') return 'fence';
  if (name === 'bamboo-grove' || name === 'pine-tree' || name === 'moss-rock') return 'nature';
  if (name === 'stone-steps') return 'flat';
  return 'furniture';
}

/** Retângulo sólido da base de um objeto de largura w e altura h, com base em (x, y). */
function feudalBlocker(kind: BlockKind, x: number, y: number, w: number): Rect[] {
  switch (kind) {
    case 'building':
      return [{ x: x - w / 2 + 6, y: y - 22, w: w - 12, h: 22 }];
    case 'furniture':
      return [{ x: x - w / 2 + 4, y: y - 18, w: w - 8, h: 18 }];
    case 'fence':
      return [{ x: x - w / 2, y: y - 8, w, h: 8 }];
    case 'nature':
      return [{ x: x - w * 0.2, y: y - 14, w: w * 0.4, h: 14 }];
    case 'flat':
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Construção                                                          */
/* ------------------------------------------------------------------ */

/** Trilhas do mapa, em coordenadas de tile (x, y), como polilinhas. */
const TRAILS: Array<Array<[number, number]>> = [
  // Norte: da praça até a saída para a montanha.
  [[29.5, 11], [29.5, 7], [30.5, 3], [30.5, 0]],
  // Sul: descida em zigue-zague entre o terraço inicial e o terraço inferior.
  [[20.5, 18], [18, 21], [14, 24], [11, 28], [10, 34], [26, 43]],
  // Leste: pela rampa da falésia até a margem norte do lago.
  [[37.5, 18], [39, 22], [40, 27]],
  // Oeste: pela borda do platô até a orla da floresta.
  [[15.5, 12], [9, 13], [2, 11], [0, 11]],
];

interface Structure {
  name: string;
  /** Ponto de apoio em tiles (x, y), centro inferior do objeto. */
  ax: number;
  ay: number;
}

/** Objetos do Feudal sobre o platô (e ornamentos da floresta). */
const STRUCTURES: Structure[] = [
  // Casas em volta da praça.
  { name: 'house-machiya', ax: 22, ay: 9 },
  { name: 'house-teahouse', ax: 36, ay: 9 },
  { name: 'house-ryokan', ax: 23, ay: 15 },
  { name: 'house-sake', ax: 33, ay: 15 },
  // Praça: poço, quadro de avisos, lanternas e banco.
  { name: 'well-stone', ax: 29, ay: 11 },
  { name: 'notice-board', ax: 25, ay: 12 },
  { name: 'lantern-post', ax: 31, ay: 9 },
  { name: 'lantern-post', ax: 27, ay: 15 },
  { name: 'bench', ax: 32, ay: 11 },
  // Canteiro a oeste, com cerca e cargas.
  { name: 'bamboo-fence', ax: 20.5, ay: 10.5 },
  { name: 'vegetable-crates', ax: 17, ay: 14 },
  { name: 'produce-basket', ax: 20, ay: 15 },
  // Lenha, barris e fardos perto das casas.
  { name: 'firewood', ax: 25, ay: 9 },
  { name: 'water-barrels', ax: 38, ay: 12 },
  { name: 'hay-bale', ax: 34, ay: 16 },
  { name: 'rice-bales', ax: 31, ay: 16 },
  { name: 'pottery-jars', ax: 26, ay: 17 },
  // Ornamentos na borda e na floresta.
  { name: 'pine-tree', ax: 40, ay: 8 },
  { name: 'pine-tree', ax: 20, ay: 6 },
  { name: 'moss-rock', ax: 25, ay: 6 },
  { name: 'bamboo-grove', ax: 10, ay: 9 },
  { name: 'bamboo-grove', ax: 48, ay: 12 },
  { name: 'pine-tree', ax: 12, ay: 21 },
  { name: 'moss-rock', ax: 46, ay: 33 },
];

/** Escada de pedra que desce da falésia sul (sobre a abertura da borda). */
const STAIRS = { name: 'stone-steps', ax: 21, ay: 18 };

/** Canteiro de terra escura (overlay) sobre o platô, em tiles. */
const FARM_PLOT = { x0: 18, x1: 21, y0: 11, y1: 12 };

export function buildVillageMap(seed = 2024): VillageMap {
  const rng = makeRng(seed);

  // 1) Chão base: grama variada, com flores raras.
  const ground = grid(0);
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      ground[ty]![tx] = rng() < 0.06 ? 3 : [0, 1, 2, 4, 5][Math.floor(rng() * 5)]!;
    }
  }

  // 2) Sólidos de tile: falésia do platô e água do lago.
  const blocked = grid(false);
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      const p = plateauChar(tx, ty);
      const q = pondChar(tx, ty);
      if (p === 'c' || p === '?' || q === 'w') blocked[ty]![tx] = true;
    }
  }

  // 3) Sobreposição: trilhas, canteiro e a água.
  const overlay = grid(-1);
  const reserved = new Set<string>();
  const reserveRing = (tx: number, ty: number, r: number): void => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) reserved.add(key(tx + dx, ty + dy));
    }
  };

  for (const trail of TRAILS) {
    for (let i = 0; i < trail.length - 1; i++) {
      const [x0, y0] = trail[i]!;
      const [x1, y1] = trail[i + 1]!;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const tx = Math.floor(x0 + (x1 - x0) * t);
        const ty = Math.floor(y0 + (y1 - y0) * t);
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const cx = tx + dx;
            const cy = ty + dy;
            if (cx < 0 || cy < 0 || cx >= MAP_COLS || cy >= MAP_ROWS) continue;
            if (blocked[cy]![cx]) continue;
            overlay[cy]![cx] = rng() < 0.8 ? 7 : 8;
          }
        }
        reserveRing(tx, ty, 1);
      }
    }
  }

  for (let ty = FARM_PLOT.y0; ty <= FARM_PLOT.y1; ty++) {
    for (let tx = FARM_PLOT.x0; tx <= FARM_PLOT.x1; tx++) {
      overlay[ty]![tx] = rng() < 0.5 ? 10 : 11;
    }
  }

  // Escada: tiles sob a escada também viram terra (passagem).
  for (const tx of [20, 21]) {
    overlay[17]![tx] = 9;
    overlay[18]![tx] = 9;
  }

  // Fase 1: base do relevo, sem casas, árvores ou decoração.
  // Mantém o chão modular, os caminhos, o platô, o lago e as colisões do terreno.
  const baseImages: ImageItem[] = [
    ...TERRACES.map((terrace, index): ImageItem => ({
      texture: PLATEAU_IMAGE.key,
      x: terrace.col * TILE,
      y: terrace.row * TILE,
      scale: 2,
      depth: 0.1 + index * 0.001,
    })),
    { texture: POND_IMAGE.key, x: POND_COL * TILE, y: POND_ROW * TILE, scale: 2, depth: 0.1 },
  ];
  for (let cy = 0; cy < POND_ROWS.length; cy++) {
    const row = POND_ROWS[cy]!;
    for (let cx = 0; cx < row.length; cx++) {
      if (row[cx] === 'w') {
        baseImages.push({
          texture: LAKE_KEY,
          frame: LAKE_FRAME,
          x: (POND_COL + cx) * TILE,
          y: (POND_ROW + cy) * TILE,
          scale: 2,
          depth: 0.15,
        });
      }
    }
  }

  const baseTileSolids: Rect[] = [];
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    let runStart = -1;
    for (let tx = 0; tx <= MAP_COLS; tx++) {
      const isSolid = tx < MAP_COLS && blocked[ty]![tx] === true;
      if (isSolid && runStart < 0) runStart = tx;
      if (!isSolid && runStart >= 0) {
        baseTileSolids.push({ x: runStart * TILE, y: ty * TILE, w: (tx - runStart) * TILE, h: TILE });
        runStart = -1;
      }
    }
  }

  const baseSpawn = { x: SPAWN_TILE.x * TILE, y: SPAWN_TILE.y * TILE };
  const basePlayerBox: Rect = { x: baseSpawn.x - 12, y: baseSpawn.y + 13, w: 24, h: 24 };
  if (baseTileSolids.some((solid) => overlaps(basePlayerBox, solid))) {
    throw new Error('O ponto de partida está bloqueado na base do terreno.');
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    ground,
    overlay,
    images: baseImages,
    decor: [],
    tileSolids: baseTileSolids,
    solids: [...baseTileSolids],
    spawn: baseSpawn,
    plateauCells: { col: PLATEAU_COL, row: PLATEAU_ROW },
  };

  // 4) Objetos do Feudal (casas, praça, canteiro, ornamentos).
  const decor: Decor[] = [];
  const addFeudal = (name: string, ax: number, ay: number): void => {
    const prop = FEUDAL_PROPS[name];
    if (!prop) throw new Error(`Peça do Feudal '${name}' não existe no catálogo.`);
    const x = ax * TILE;
    const y = ay * TILE;
    const kind = blockKindOf(name);
    decor.push({
      texture: `vil-${name}`,
      x,
      y,
      w: prop.w,
      h: prop.h,
      flat: kind === 'flat',
      blockers: feudalBlocker(kind, x, y, prop.w),
    });
    // Reserva a área da base e uma faixa ao redor, para árvores e arbustos não nascerem em cima.
    const base = feudalBlocker(kind, x, y, prop.w)[0];
    const bounds = base ?? { x: x - prop.w / 2, y: y - prop.h, w: prop.w, h: prop.h };
    for (const [tx, ty] of tilesOf(bounds)) reserveRing(tx, ty, 1);
  };

  for (const s of STRUCTURES) addFeudal(s.name, s.ax, s.ay);
  addFeudal(STAIRS.name, STAIRS.ax, STAIRS.ay);

  // 5) Árvores do Harmonious: floresta densa com clareiras, espaçamento entre troncos.
  const sheetByKey = new Map(HARMONIOUS_SHEETS.map((s) => [s.key, s]));
  const treeSheets = ['hm-trees-big', 'hm-trees-bigger', 'hm-trees-small'].map((k) => sheetByKey.get(k)!);
  const clearings = [
    { x: 8, y: 30, r: 4 },
    { x: 50, y: 8, r: 3 },
    { x: 46, y: 36, r: 3 },
  ];
  const treeBase = new Set<string>();

  const pondRing = (tx: number, ty: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (pondChar(tx + dx, ty + dy) !== '.') return true;
      }
    }
    return false;
  };
  const inPlateau = (tx: number, ty: number): boolean => plateauChar(tx, ty) !== '.';

  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      if (reserved.has(key(tx, ty)) || inPlateau(tx, ty) || pondRing(tx, ty)) continue;
      if (overlay[ty]![tx] !== -1) continue;

      // Espaçamento: nenhum tronco nos 8 vizinhos.
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (treeBase.has(key(tx + dx, ty + dy))) near = true;
        }
      }
      if (near) continue;

      const border = Math.min(tx, ty, MAP_COLS - 1 - tx, MAP_ROWS - 1 - ty);
      let p = border <= 4 ? 0.6 : 0.36;
      for (const c of clearings) {
        if (Math.hypot(tx - c.x, ty - c.y) <= c.r) p *= 0.1;
      }
      if (rng() >= p) continue;

      const sheet = treeSheets[Math.floor(rng() * treeSheets.length)]!;
      const frames: SheetFrame[] = sheet.frames;
      const frame = frames[Math.floor(rng() * frames.length)]!;
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + 56;
      decor.push({
        texture: sheet.key,
        frame: frame.name,
        x,
        y,
        w: frame.w * HM_SCALE,
        h: frame.h * HM_SCALE,
        flat: false,
        blockers: [{ x: x - 8, y: y - 16, w: 16, h: 16 }],
      });
      treeBase.add(key(tx, ty));
    }
  }
  // Árvores ocupam tiles: marca para os outros objetos não usarem.
  for (const k of treeBase) reserved.add(k);

  // 6) Arbustos, grama, flores, pedras e rochas em tiles livres.
  const bushes = sheetByKey.get('hm-bushes')!;
  const grassy = sheetByKey.get('hm-grass')!;
  const flowers = sheetByKey.get('hm-flowers')!;
  const pebbles = sheetByKey.get('hm-pebbles')!;
  const rocks = sheetByKey.get('hm-rocks')!;
  const stumps = sheetByKey.get('hm-stumps')!;
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      if (reserved.has(key(tx, ty)) || inPlateau(tx, ty) || pondRing(tx, ty)) continue;
      if (overlay[ty]![tx] !== -1) continue;
      const r = rng();
      const cx = tx * TILE + TILE / 2 + (rng() - 0.5) * 24;
      const cy = ty * TILE + TILE - 8 + (rng() - 0.5) * 8;
      if (r < 0.1) {
        const f = bushes.frames[Math.floor(rng() * bushes.frames.length)]!;
        decor.push({ texture: bushes.key, frame: f.name, x: cx, y: cy, w: f.w * HM_SCALE, h: f.h * HM_SCALE, flat: false, blockers: [] });
      } else if (r < 0.22) {
        const pool = rng() < 0.2 ? flowers : grassy;
        const f = pool.frames[Math.floor(rng() * pool.frames.length)]!;
        decor.push({ texture: pool.key, frame: f.name, x: cx, y: cy, w: f.w * HM_SCALE, h: f.h * HM_SCALE, flat: true, blockers: [] });
      } else if (r < 0.235) {
        const f = pebbles.frames[Math.floor(rng() * pebbles.frames.length)]!;
        decor.push({ texture: pebbles.key, frame: f.name, x: cx, y: cy, w: f.w * HM_SCALE, h: f.h * HM_SCALE, flat: true, blockers: [] });
      } else if (r < 0.245) {
        const f = stumps.frames[Math.floor(rng() * stumps.frames.length)]!;
        decor.push({ texture: stumps.key, frame: f.name, x: cx, y: cy, w: f.w * HM_SCALE, h: f.h * HM_SCALE, flat: false, blockers: [] });
      } else if (r < 0.255) {
        const f = rocks.frames[Math.floor(rng() * rocks.frames.length)]!;
        const w = f.w * HM_SCALE;
        const h = f.h * HM_SCALE;
        decor.push({
          texture: rocks.key,
          frame: f.name,
          x: cx,
          y: cy,
          w,
          h,
          flat: false,
          blockers: [{ x: cx - w / 2 + 4, y: cy - 10, w: w - 8, h: 10 }],
        });
      }
    }
  }

  // 7) Lago e platô como imagens; água nos buracos do lago.
  const images: ImageItem[] = [
    { texture: PLATEAU_IMAGE.key, x: PLATEAU_COL * TILE, y: PLATEAU_ROW * TILE, scale: 2, depth: 0.1 },
    { texture: POND_IMAGE.key, x: POND_COL * TILE, y: POND_ROW * TILE, scale: 2, depth: 0.1 },
  ];
  for (let cy = 0; cy < POND_ROWS.length; cy++) {
    const row = POND_ROWS[cy]!;
    for (let cx = 0; cx < row.length; cx++) {
      if (row[cx] === 'w') {
        images.push({
          texture: LAKE_KEY,
          frame: LAKE_FRAME,
          x: (POND_COL + cx) * TILE,
          y: (POND_ROW + cy) * TILE,
          scale: 2,
          depth: 0.15,
        });
      }
    }
  }

  // 8) Sólidos: falésia e água (por tile, mesclados por linha), e os blockers dos objetos.
  const tileSolids: Rect[] = [];
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    let runStart = -1;
    for (let tx = 0; tx <= MAP_COLS; tx++) {
      const isSolid = tx < MAP_COLS && blocked[ty]![tx] === true;
      if (isSolid && runStart < 0) runStart = tx;
      if (!isSolid && runStart >= 0) {
        tileSolids.push({ x: runStart * TILE, y: ty * TILE, w: (tx - runStart) * TILE, h: TILE });
        runStart = -1;
      }
    }
  }

  const solids: Rect[] = [...tileSolids];
  for (const d of decor) solids.push(...d.blockers);

  // 9) Validação do layout (falha cedo, sem navegador).
  for (const d of decor) {
    for (const b of d.blockers) {
      for (const [tx, ty] of tilesOf(b)) {
        if (blocked[ty]?.[tx]) {
          throw new Error(`Colisão de objeto '${d.texture}' sobre falésia/água em (${tx}, ${ty}).`);
        }
      }
    }
  }
  const blockerList = decor.flatMap((d) => d.blockers);
  for (let i = 0; i < blockerList.length; i++) {
    for (let j = i + 1; j < blockerList.length; j++) {
      if (overlaps(blockerList[i]!, blockerList[j]!)) {
        throw new Error(`Sólidos sobrepostos: ${JSON.stringify(blockerList[i])} e ${JSON.stringify(blockerList[j])}.`);
      }
    }
  }
  const spawn = { x: SPAWN_TILE.x * TILE, y: SPAWN_TILE.y * TILE };
  const playerBox: Rect = { x: spawn.x - 12, y: spawn.y + 13, w: 24, h: 24 };
  for (const s of solids) {
    if (overlaps(playerBox, s)) throw new Error('O ponto de partida está bloqueado.');
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    ground,
    overlay,
    images,
    decor,
    tileSolids,
    solids,
    spawn,
    plateauCells: { col: PLATEAU_COL, row: PLATEAU_ROW },
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
