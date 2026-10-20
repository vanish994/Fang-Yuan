import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';
import { readStyles } from './support/markup.mjs';

const { GU_CATALOG, GU_SLOTS } = await import(moduleURL('combat/combatConfig'));

test('sprite enviado mapeia os quatro Gu aos quadrantes reais e aos slots corretos', () => {
  const png = readFileSync(new URL('../public/assets/ui/gu-icons-2x2-64.png', import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 128);
  assert.deepEqual(GU_SLOTS, ['attack', 'passive', 'movement', 'support']);
  assert.match(GU_CATALOG.moonlight.label, /Moonlight/);
  assert.match(GU_CATALOG['liquor-worm'].label, /Liquor/);
  assert.match(GU_CATALOG['stone-skin'].label, /Stone Skin/);
  assert.match(GU_CATALOG.whirlwind.label, /Whirlwind/);
  assert.equal(GU_CATALOG['stone-skin'].slot, 'passive');
  assert.equal(GU_CATALOG.whirlwind.slot, 'movement');
  const css = readStyles();
  for (const [id, position] of [
    ['moonlight', '0 0'], ['liquor-worm', '-48px 0'],
    ['stone-skin', '0 -48px'], ['whirlwind', '-48px -48px'],
  ]) {
    assert.match(css, new RegExp(`\\.gu-icon\\[data-gu="${id}"\\] \\{ background-position: ${position.replace('-', '\\-')}; \\}`));
  }
  assert.match(css, /gu-icons-2x2-64\.png/);
  const hud = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  // O HUD é genérico por slot: o mesmo botão mostra o Gu equipado no motor.
  assert.match(hud, /data-action="attack"[^>]*><span class="gu-icon" data-gu="moonlight"/);
  assert.match(hud, /data-action="movement"[^>]*><span class="gu-icon" data-gu="whirlwind"/);
  assert.doesNotMatch(hud, /data-gu="stone-skin"|data-gu="liquor-worm"/);
});
