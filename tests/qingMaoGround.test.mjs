import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/world/qingMaoGround.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  AREA_SIZE, CHUNK_SIZE, TILES_PER_SIDE, TILE_SIZE, WORLD_SIZE, FOREST_BORDER_TILES,
  buildGroundChunk, buildForestTrees, isForestTile, isWalkableTile, isSolidForestTile,
  canTraverseTiles, walkableDestination,
} = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

const navSource = readFileSync(new URL('../src/world/cardinalNavigation.ts', import.meta.url), 'utf8');
const navJS = ts.transpileModule(navSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { shortestWorldWaypoints } =
  await import(`data:text/javascript;base64,${Buffer.from(navJS).toString('base64')}`);

test('solo 3×3 chunks: grama do Mixel contínua sob as árvores, sem estrada ou relevo', () => {
  assert.equal(AREA_SIZE, 3);
  assert.equal(CHUNK_SIZE, 16);
  assert.equal(TILES_PER_SIDE, 48);
  assert.equal(TILE_SIZE, 32);
  assert.equal(WORLD_SIZE, 1536);
  for (let cy = 0; cy < AREA_SIZE; cy++) {
    for (let cx = 0; cx < AREA_SIZE; cx++) {
      const chunk = buildGroundChunk(cx, cy);
      assert.deepEqual(Object.keys(chunk), ['base', 'detail']);
      assert.equal(chunk.base.length, CHUNK_SIZE);
      assert.equal(chunk.detail.length, CHUNK_SIZE);
      assert.ok(chunk.base.every((row) => row.length === CHUNK_SIZE && row.every((tile) => tile === 11)));
      assert.ok(chunk.detail.every((row) => row.length === CHUNK_SIZE
        && row.every((tile) => tile === -1 || (tile >= 0 && tile <= 18))));
      assert.deepEqual(chunk, buildGroundChunk(cx, cy));
    }
  }
  assert.throws(() => buildGroundChunk(3, 0), RangeError);
  assert.throws(() => buildGroundChunk(-1, 0), RangeError);
});

test('mata fecha os quatro lados sem costuras nos chunks; clareira mantém caminhos cardinais', () => {
  assert.equal(FOREST_BORDER_TILES, 7);
  for (let y = 0; y < TILES_PER_SIDE; y++) {
    for (let x = 0; x < TILES_PER_SIDE; x++) {
      assert.equal(isWalkableTile(x, y), !isForestTile(x, y));
      assert.equal(isSolidForestTile(x, y) && isWalkableTile(x, y), false);
      assert.equal(canTraverseTiles(x, y, x + 1, y + 1), false);
      if (x < FOREST_BORDER_TILES || x >= TILES_PER_SIDE - FOREST_BORDER_TILES
        || y < FOREST_BORDER_TILES || y >= TILES_PER_SIDE - FOREST_BORDER_TILES) {
        assert.equal(isForestTile(x, y), true, `borda aberta em ${x},${y}`);
      }
      if (x >= 9 && x < TILES_PER_SIDE - 9 && y >= 9 && y < TILES_PER_SIDE - 9) {
        assert.equal(isWalkableTile(x, y), true, `clareira bloqueada em ${x},${y}`);
      }
      if (x + 1 < TILES_PER_SIDE) {
        assert.equal(canTraverseTiles(x, y, x + 1, y),
          isWalkableTile(x, y) && isWalkableTile(x + 1, y));
      }
    }
  }
  assert.equal(isWalkableTile(-1, 5), false);
  assert.equal(isWalkableTile(48, 5), false);
  assert.equal(canTraverseTiles(47, 4, 48, 4), false);
  for (const y of [16, 32]) {
    for (let x = 9; x < 39; x++) assert.equal(canTraverseTiles(x, y - 1, x, y), true);
  }
});

test('mosaicos de árvores Mixel cobrem densamente a mata, inclusive nos cantos', () => {
  const trees = buildForestTrees();
  assert.deepEqual(trees, buildForestTrees());
  assert.ok(trees.length >= 200);
  assert.deepEqual(new Set(trees.map((tree) => tree.variant)), new Set([0, 1, 2]));
  const covered = new Set();
  for (const tree of trees) {
    assert.equal(tree.x % TILE_SIZE, 0);
    assert.equal(tree.y % TILE_SIZE, 0);
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const x = tree.x / TILE_SIZE + dx, y = tree.y / TILE_SIZE + dy;
        assert.equal(isForestTile(x, y), true, `árvore fora da mata em ${x},${y}`);
        covered.add(`${x},${y}`);
      }
    }
  }
  const deepForest = Array.from({ length: TILES_PER_SIDE }, (_, y) =>
    Array.from({ length: TILES_PER_SIDE }, (_, x) => [x, y]))
    .flat().filter(([x, y]) => x < 5 || x >= 43 || y < 5 || y >= 43);
  assert.ok(deepForest.filter(([x, y]) => covered.has(`${x},${y}`)).length / deepForest.length > 0.82);
});

test('toques no interior preservam o pixel; toques na mata terminam antes da floresta', () => {
  const start = { x: 24.5 * TILE_SIZE, y: 24.5 * TILE_SIZE };
  const grass = { x: 10 * TILE_SIZE + 3, y: 20 * TILE_SIZE + 5 };
  assert.deepEqual(walkableDestination(grass.x, grass.y), grass);
  for (const tap of [[0, 768], [1535, 768], [768, 0], [768, 1535]]) {
    const goal = walkableDestination(...tap);
    assert.ok(goal && isWalkableTile(Math.floor(goal.x / TILE_SIZE), Math.floor(goal.y / TILE_SIZE)));
    const route = shortestWorldWaypoints(start, goal, TILES_PER_SIDE, TILE_SIZE,
      isWalkableTile, canTraverseTiles);
    assert.deepEqual(route?.at(-1), goal);
  }
  assert.equal(shortestWorldWaypoints(start, { x: 0, y: 768 }, TILES_PER_SIDE,
    TILE_SIZE, isWalkableTile, canTraverseTiles), null);
  assert.equal(walkableDestination(-10, 0), null);
});

test('atlas de cenário vem somente do pack Mixel 32×32', () => {
  const ground = readFileSync(new URL('../public/assets/qing-mao/ground.png', import.meta.url));
  const details = readFileSync(new URL('../public/assets/qing-mao/details.png', import.meta.url));
  const trees = readFileSync(new URL('../public/assets/qing-mao/trees.png', import.meta.url));
  assert.equal(ground.readUInt32BE(16), 384);
  assert.equal(ground.readUInt32BE(20), 384);
  assert.equal(details.readUInt32BE(16), 384);
  assert.equal(details.readUInt32BE(20), 128);
  assert.equal(trees.readUInt32BE(16), 384);
  assert.equal(trees.readUInt32BE(20), 320);
});
