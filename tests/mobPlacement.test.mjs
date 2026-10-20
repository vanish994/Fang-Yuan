import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const { placeExtraSpawns, placementRank, BORDER_TILES, MIN_SPAWN_GAP_TILES,
  AVOID_GAP_TILES } = await import(moduleURL('world/mobPlacement'));

const openMap = () => true;
const base = (overrides = {}) => ({
  tiles: 48, tileSize: 32, seed: 42, extra: 5,
  species: ['mob-wild-boar', 'mob-moon-rabbit'], isFree: openMap, avoid: [], ...overrides,
});
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test('coloca exatamente a quantidade pedida, dentro das bordas e em tiles inteiros', () => {
  const spawns = placeExtraSpawns(base());
  assert.equal(spawns.length, 5);
  for (const spawn of spawns) {
    assert.ok(Number.isInteger(spawn.x) && Number.isInteger(spawn.y));
    assert.ok(spawn.x >= BORDER_TILES && spawn.x < 48 - BORDER_TILES);
    assert.ok(spawn.y >= BORDER_TILES && spawn.y < 48 - BORDER_TILES);
    assert.ok(spawn.speciesId);
    assert.equal(spawn.id, `${spawn.speciesId}-extra-${spawns.indexOf(spawn) + 1}`);
  }
});

test('mesma seed e mesmas espécies devolvem as mesmas posições', () => {
  const first = placeExtraSpawns(base());
  const second = placeExtraSpawns(base());
  assert.deepEqual(first, second);
  const other = placeExtraSpawns(base({ seed: 43 }));
  assert.notDeepEqual(first.map(s => [s.x, s.y]), other.map(s => [s.x, s.y]));
});

test('criaturas extras ficam separadas umas das outras e longe dos pontos protegidos', () => {
  const avoid = [{ x: 24 * 32, y: 24 * 32 }, { x: 12 * 32, y: 30 * 32 }];
  const spawns = placeExtraSpawns(base({ avoid }));
  for (let i = 0; i < spawns.length; i += 1) {
    for (let j = i + 1; j < spawns.length; j += 1) {
      assert.ok(chebyshev(spawns[i], spawns[j]) >= MIN_SPAWN_GAP_TILES,
        `${spawns[i].id} e ${spawns[j].id} estão juntos`);
    }
    for (const point of avoid) {
      const tile = { x: point.x / 32, y: point.y / 32 };
      assert.ok(chebyshev(spawns[i], tile) >= AVOID_GAP_TILES,
        `${spawns[i].id} nasceu em cima de um ponto protegido`);
    }
  }
});

test('nunca coloca criatura em tile bloqueado', () => {
  // Só a metade esquerda do mapa é livre.
  const spawns = placeExtraSpawns(base({ extra: 8, isFree: (x) => x < 24 * 32 }));
  assert.equal(spawns.length, 8);
  assert.ok(spawns.every(spawn => spawn.x < 24));
});

test('mapa sem espaço livre devolve menos criaturas em vez de sobrepor', () => {
  const spawns = placeExtraSpawns(base({ extra: 10, isFree: () => false }));
  assert.deepEqual(spawns, []);
  // Um único tile livre no mapa inteiro: cabe exatamente uma criatura.
  const single = placeExtraSpawns(base({ extra: 5, isFree: (x, y) => x === 24 * 32 && y === 24 * 32 }));
  assert.equal(single.length, 1);
  assert.deepEqual([single[0].x, single[0].y], [24, 24]);
});

test('extras só usam as espécies permitidas, em rodízio e sem repetir id', () => {
  const species = ['mob-grey-wolf', 'mob-green-snake', 'mob-stone-lizard'];
  const spawns = placeExtraSpawns(base({ extra: 6, species }));
  assert.ok(spawns.every(spawn => species.includes(spawn.speciesId)));
  assert.equal(new Set(spawns.map(spawn => spawn.id)).size, spawns.length);
  assert.deepEqual(spawns.map(spawn => spawn.speciesId), [...species, ...species]);
});

test('sem espécies ou sem extras não gera nada', () => {
  assert.deepEqual(placeExtraSpawns(base({ extra: 0 })), []);
  assert.deepEqual(placeExtraSpawns(base({ species: [] })), []);
});

test('placementRank é estável e depende da seed e da posição', () => {
  assert.equal(placementRank(7, 10, 20), placementRank(7, 10, 20));
  assert.notEqual(placementRank(7, 10, 20), placementRank(8, 10, 20));
  assert.notEqual(placementRank(7, 10, 20), placementRank(7, 20, 10));
  assert.ok(Number.isInteger(placementRank(7, 10, 20)));
});
