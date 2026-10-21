import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';
import { readStyles } from './support/markup.mjs';

const { GU_CATALOG, GU_SLOTS } = await import(moduleURL('combat/combatConfig'));

const CELL = 64;
const atlas = readFileSync(new URL('../public/assets/ui/gu-icons-8x8-64.png', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../art/source/ui/ui-kit.json', import.meta.url), 'utf8'));

test('atlas de ícones do pack tem grade 8×8 de 64 px e cobre os 26 Gu do catálogo', () => {
  assert.equal(atlas.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(atlas.readUInt32BE(16), CELL * 8);
  assert.equal(atlas.readUInt32BE(20), CELL * 8);
  assert.deepEqual(GU_SLOTS, ['attack', 'passive', 'movement', 'support']);

  const ids = Object.keys(GU_CATALOG);
  assert.equal(ids.length, 26);
  assert.deepEqual(Object.keys(manifest.gu_cells).sort(), [...ids].sort());
  const cells = new Set(Object.values(manifest.gu_cells));
  assert.equal(cells.size, ids.length, 'cada Gu usa uma célula própria');
  // A folha original traz 5 linhas de 8 células; a grade publicada tem 8×8.
  for (const cell of cells) assert.ok(cell >= 0 && cell < 40, `célula ${cell} fora da folha`);
});

test('CSS posiciona cada Gu pela coluna/linha da grade, sem duplicar a arte', () => {
  const css = readStyles();
  assert.match(css, /gu-icons-8x8-64\.png/);
  assert.match(css, /--cell:\s*48px/);
  assert.match(css, /\.combat-actions \.gu-icon \{ --cell: 40px; \}/);
  for (const [id, index] of Object.entries(manifest.gu_cells)) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    assert.match(css, new RegExp(
      `\\.gu-icon\\[data-gu="${id}"\\] \\{ --col: ${column}; --row: ${row}; \\}`),
    `Gu ${id} sem posição na grade`);
  }
  // O HUD é genérico por slot: o mesmo botão mostra o Gu equipado no motor.
  const hud = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  assert.match(hud, /data-action="attack"[^>]*><span class="gu-icon" data-gu="moonlight"/);
  assert.match(hud, /data-action="movement"[^>]*><span class="gu-icon" data-gu="whirlwind"/);
  assert.doesNotMatch(hud, /data-gu="stone-skin"|data-gu="liquor-worm"/);
});

test('quatro slots equipáveis continuam mapeados para os Gu certos', () => {
  assert.match(GU_CATALOG.moonlight.label, /Moonlight/);
  assert.match(GU_CATALOG['liquor-worm'].label, /Liquor/);
  assert.match(GU_CATALOG['stone-skin'].label, /Stone Skin/);
  assert.match(GU_CATALOG.whirlwind.label, /Whirlwind/);
  assert.equal(GU_CATALOG['stone-skin'].slot, 'passive');
  assert.equal(GU_CATALOG.whirlwind.slot, 'movement');
});
