import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/world/cardinalNavigation.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { findCardinalPath, toWorldWaypoints, shortestWorldWaypoints } =
  await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const facingSource = readFileSync(new URL('../src/entities/directions.ts', import.meta.url), 'utf8');
const facingJavaScript = ts.transpileModule(facingSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { shouldTurnForSegment, MIN_TURN_DISTANCE } =
  await import(`data:text/javascript;base64,${Buffer.from(facingJavaScript).toString('base64')}`);

test('caminho mais curto usa exclusivamente vizinhos cardinais', () => {
  const path = findCardinalPath({ x: 0, y: 0 }, { x: 4, y: 3 }, 5, 5,
    () => true, () => true);
  assert.ok(path);
  assert.equal(path.length, 8); // 4 + 3 passos, sem diagonal
  for (let i = 1; i < path.length; i++) {
    assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
  }
  const points = toWorldWaypoints({ x: 16, y: 16 }, path, 32);
  let previous = { x: 16, y: 16 };
  for (const point of points) {
    assert.ok(point.x === previous.x || point.y === previous.y, 'trecho diagonal');
    previous = point;
  }
});

test('contorna bloqueios e recusa destino fora da área ou inacessível', () => {
  const free = (x, y) => !(x === 1 && y < 2);
  const canStep = (_x, _y, nx, ny) => free(nx, ny);
  const path = findCardinalPath({ x: 0, y: 0 }, { x: 2, y: 0 }, 4, 4, free, canStep);
  assert.ok(path && path.every(({ x, y }) => free(x, y)));
  assert.ok(path.length > 3);
  assert.equal(findCardinalPath({ x: 0, y: 0 }, { x: 4, y: 0 }, 4, 4, free, canStep), null);
  assert.equal(findCardinalPath({ x: 0, y: 0 }, { x: 1, y: 0 }, 4, 4, free, canStep), null);
});

test('desvio pelo grid pode ser comprimido em um segmento reto', () => {
  const current = { x: 16, y: 16 };
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  const points = toWorldWaypoints(current, path, 32);
  assert.deepEqual(points, [{ x: 48, y: 16 }]); // só caminha para a direita; não vira ao parar
  assert.deepEqual(toWorldWaypoints(current, [path[0]], 32), []); // toque no tile atual
});

test('alinha uma posição intermediária em eixos retos antes de seguir o caminho', () => {
  const current = { x: 21, y: 20 };
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const points = toWorldWaypoints(current, path, 32);
  assert.deepEqual(points.at(-1), { x: 48, y: 48 });
  let previous = current;
  for (const point of points) {
    assert.ok(point.x === previous.x || point.y === previous.y);
    previous = point;
  }
});

test('toque em terreno livre escolhe distância Manhattan mínima e chega ao pixel tocado', () => {
  const free = () => true;
  const step = () => true;
  for (const [from, to] of [
    [{ x: 16, y: 16 }, { x: 88, y: 69 }],
    [{ x: 205, y: 402 }, { x: 91, y: 47 }],
    [{ x: 48, y: 48 }, { x: 51, y: 92 }],
    [{ x: 48, y: 48 }, { x: 49, y: 50 }],
  ]) {
    const points = shortestWorldWaypoints(from, to, 48, 32, free, step);
    assert.ok(points);
    assert.deepEqual(points.at(-1), to);
    let length = 0, previous = from;
    for (const point of points) {
      assert.ok(point.x === previous.x || point.y === previous.y, 'diagonal');
      length += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      previous = point;
    }
    assert.equal(length, Math.abs(to.x - from.x) + Math.abs(to.y - from.y));
    assert.ok(points.length <= 2, 'gramado livre não precisa de desvios');
  }
});

test('perna pequena vem primeiro: não gira só para corrigir alguns pixels ao chegar', () => {
  const free = () => true, step = () => true;
  const points = shortestWorldWaypoints({ x: 48, y: 48 }, { x: 51, y: 128 }, 48, 32, free, step);
  assert.deepEqual(points, [{ x: 51, y: 48 }, { x: 51, y: 128 }]);
  const horizontal = shortestWorldWaypoints({ x: 48, y: 48 }, { x: 128, y: 51 }, 48, 32, free, step);
  assert.deepEqual(horizontal, [{ x: 48, y: 51 }, { x: 128, y: 51 }]);
});

test('retocar durante a caminhada mantém a direção inicial quando a distância é igual', () => {
  const free = () => true, step = () => true;
  const current = { x: 79.3, y: 47.8 };
  const goal = { x: 180.5, y: 52.4 };
  const idle = shortestWorldWaypoints(current, goal, 48, 32, free, step, 'right');
  const moving = shortestWorldWaypoints(current, goal, 48, 32, free, step, 'right', true);
  assert.deepEqual(idle, [{ x: 79.3, y: 52.4 }, goal]); // parado: perna pequena primeiro
  assert.deepEqual(moving, [{ x: 180.5, y: 47.8 }, goal]); // andando: segue para a direita
  for (const route of [idle, moving]) {
    const distance = route.reduce((sum, point, index) => {
      const before = index === 0 ? current : route[index - 1];
      return sum + Math.abs(point.x - before.x) + Math.abs(point.y - before.y);
    }, 0);
    assert.ok(Math.abs(distance - (Math.abs(goal.x - current.x) + Math.abs(goal.y - current.y))) < 0.001);
  }
});

test('correções curtas preservam a orientação do personagem', () => {
  assert.equal(MIN_TURN_DISTANCE, 8);
  assert.equal(shouldTurnForSegment(2.5), false);
  assert.equal(shouldTurnForSegment(7.99), false);
  assert.equal(shouldTurnForSegment(8), true);
  assert.equal(shouldTurnForSegment(40), true);
});

test('no mesmo tile, move até o toque; fora da área não cria trajeto', () => {
  const free = () => true, step = () => true;
  assert.deepEqual(shortestWorldWaypoints({ x: 48, y: 48 }, { x: 51, y: 50 }, 48, 32, free, step)?.at(-1), { x: 51, y: 50 });
  assert.deepEqual(shortestWorldWaypoints({ x: 48, y: 48 }, { x: 48, y: 48 }, 48, 32, free, step), []);
  assert.equal(shortestWorldWaypoints({ x: 48, y: 48 }, { x: -1, y: 50 }, 48, 32, free, step), null);
});

test('quando a rota direta é bloqueada, contorna sem atravessar o obstáculo', () => {
  const free = (x, y) => !(x === 1 && y < 2);
  const step = (_x, _y, nx, ny) => free(nx, ny);
  const points = shortestWorldWaypoints({ x: 16, y: 16 }, { x: 80, y: 16 }, 4, 32, free, step);
  assert.ok(points && points.length > 2);
  assert.deepEqual(points.at(-1), { x: 80, y: 16 });
});

test('atlas de caminhada possui 6 quadros × 4 direções de 32px', () => {
  const png = readFileSync(new URL('../public/assets/characters/fang-yuan-walk-32.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 192);
  assert.equal(png.readUInt32BE(20), 128);
});
