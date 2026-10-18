/**
 * Gera um chunk de teste (20×12 tiles de 64 px = 1280×768) para validar o personagem.
 *
 * Índices do atlas ground-atlas-64.png (6 colunas × 2 linhas):
 *   0–5  → grama (3 tem flores)
 *   6–11 → terra (6 areia, 7–8 terra, 9 pedras, 10–11 terra escura)
 *
 * O mapa é determinístico (seed fixa), então sempre sai igual entre execuções.
 */
export const CHUNK_COLS = 20;
export const CHUNK_ROWS = 12;

const GRASS = [0, 1, 2, 4, 5];
const GRASS_FLOWERS = 3;
const PATH_DIRT = [7, 8];
const PATCH_DIRT = [7, 8, 10];

/** Gerador pseudoaleatório simples (LCG) com seed fixa. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function buildTestChunk(): number[][] {
  const rng = createRng(1234);
  const rows: number[][] = [];

  // Caminho de terra horizontal no meio do chunk (2 linhas de altura).
  const pathTop = 5;
  const pathBottom = 6;
  // Remendo de terra no canto superior direito.
  const patch = { x0: 13, x1: 17, y0: 2, y1: 4 };

  for (let y = 0; y < CHUNK_ROWS; y++) {
    const row: number[] = [];
    for (let x = 0; x < CHUNK_COLS; x++) {
      const onPath = y >= pathTop && y <= pathBottom;
      const onPatch = x >= patch.x0 && x <= patch.x1 && y >= patch.y0 && y <= patch.y1;

      if (onPath) {
        row.push(pick(rng, PATH_DIRT));
      } else if (onPatch) {
        row.push(pick(rng, PATCH_DIRT));
      } else if (rng() < 0.05) {
        row.push(GRASS_FLOWERS);
      } else {
        row.push(pick(rng, GRASS));
      }
    }
    rows.push(row);
  }

  return rows;
}
