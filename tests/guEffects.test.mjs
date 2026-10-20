import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { moduleURL } from './support/tsModule.mjs';

const effects = await import(moduleURL('ui/guEffects'));
const { GU_CATALOG, GU_IDS } = await import(moduleURL('combat/combatConfig'));

test('folha de efeitos tem 4 formas × 4 quadros neutros e todos os quadros existem', () => {
  const path = 'public/assets/characters/gu-effects-4x4-32.png';
  const png = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 128, 'largura 4 × 32');
  assert.equal(png.readUInt32BE(20), 128, 'altura 4 × 32');
  assert.equal(png[25], 6, 'precisa de canal alfa');
  assert.ok(statSync(new URL(`../${path}`, import.meta.url)).size > 800,
    'a folha não pode estar vazia');
  assert.deepEqual(effects.GU_EFFECT_SHAPES, ['swirl', 'slash', 'smoke', 'streak']);
  assert.deepEqual(Object.values(effects.GU_EFFECT_ROW).sort(), [0, 1, 2, 3]);
});

test('cada forma aponta para quatro quadros distintos dentro da própria linha', () => {
  const seen = new Set();
  for (const shape of effects.GU_EFFECT_SHAPES) {
    const frames = effects.effectFrames(shape);
    assert.equal(frames.length, 4);
    assert.equal(frames[0], effects.GU_EFFECT_ROW[shape] * 4, `${shape}: começa na linha certa`);
    for (const frame of frames) {
      assert.ok(frame >= 0 && frame < 16, `${shape}: quadro ${frame} fora da folha 4×4`);
      assert.ok(!seen.has(frame), `quadro ${frame} repetido entre formas`);
      seen.add(frame);
    }
  }
  assert.equal(seen.size, 16);
});

test('forma segue a função do Gu e a cor é a do catálogo', () => {
  // Ataque corta, movimento deixa rastro, apoio gira, maldição solta fumaça.
  assert.equal(effects.effectShapeFor('moonlight'), 'slash');
  assert.equal(effects.effectShapeFor('bone-spear'), 'slash');
  assert.equal(effects.effectShapeFor('whirlwind'), 'streak');
  assert.equal(effects.effectShapeFor('clear-wind-wheel'), 'streak');
  assert.equal(effects.effectShapeFor('stone-skin'), 'swirl');
  assert.equal(effects.effectShapeFor('liquor-worm'), 'swirl');
  assert.equal(effects.effectShapeFor('ghost-fire'), 'smoke');
  assert.equal(effects.effectShapeFor('flash-blink'), 'smoke');

  for (const id of GU_IDS) {
    const tint = effects.effectTint(id);
    const expected = Number.parseInt(GU_CATALOG[id].visual.color.replace('#', ''), 16);
    assert.equal(tint, expected, `${id}: cor do efeito igual à do catálogo`);
    assert.ok(Number.isInteger(tint) && tint >= 0 && tint <= 0xffffff);
  }
  // Cores diferentes não podem colapsar na mesma: o efeito identifica o Gu.
  const distinct = new Set(GU_IDS.map(effects.effectTint));
  assert.ok(distinct.size > 20, `esperava muitas cores distintas, veio ${distinct.size}`);
});

test('estouros têm contagem própria, sem depender de arte nova por Gu', () => {
  for (const kind of ['cast', 'dash', 'defeat', 'death']) {
    const count = effects.GU_EFFECT_COUNT[kind];
    assert.ok(Number.isInteger(count) && count > 0 && count <= 16, `${kind}: ${count}`);
  }
  for (const shape of effects.GU_EFFECT_SHAPES) {
    const scale = effects.effectScale(shape);
    assert.ok(scale > 0 && scale <= 1, `${shape}: escala ${scale}`);
  }
  const bySlot = effects.shapesForSlot('movement');
  assert.deepEqual([...new Set(bySlot)], ['streak'], 'todo Gu de movimento usa o rastro');
  // Ataque corta, exceto as maldições de fumaça, que também ocupam o slot de ataque.
  assert.deepEqual([...new Set(effects.shapesForSlot('attack'))].sort(), ['slash', 'smoke']);
});
