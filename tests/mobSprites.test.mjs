import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/combat/mobSprites.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { MOB_ROWS, mobFrame } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('atlas recebido tem 15 mobs e quatro poses transparentes de 32 px por linha', () => {
  const png = readFileSync(new URL('../public/assets/mobs/mob-static-4dir-32.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 480);
  assert.equal(png[25], 6);
  assert.deepEqual(Object.values(MOB_ROWS), Array.from({ length: 15 }, (_, i) => i));
  for (const [id, row] of Object.entries(MOB_ROWS)) {
    assert.equal(mobFrame(id, 'down'), row * 4);
    assert.equal(mobFrame(id, 'left'), row * 4 + 1);
    assert.equal(mobFrame(id, 'up'), row * 4 + 2);
    assert.equal(mobFrame(id, 'right'), row * 4 + 3);
  }
  assert.throws(() => mobFrame('mob-demonic-boar-king', 'down'), /Mob sem sprite/);
});

test('todos os 15 mobs com sprites surgem; Rei Javali não substitui o boss', async () => {
  const catalog = readFileSync(new URL('../src/combat/mobCatalog.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(catalog, /mob\('demonic-boar-king', 'Rei Javali Demoníaco'/);
  assert.match(main, /this\.load\.spritesheet\('mob-static-4dir'/);
  assert.match(main, /frame\(mob\.id, 'down'\)/);
  assert.match(main, /art\.sprite\.setFrame\(art\.frame\(id, art\.facing\)\)/);
  assert.match(main, /this\.combat\.select\(enemy\.id\)/);
  assert.match(main, /this\.staticEnemyViews\.delete\(event\.targetId\)/);
  assert.doesNotMatch(main, /Criatura \$\{index/);
  assert.doesNotMatch(main, /this\.add\.circle\(0, -13/);
  assert.match(main, /'mob-static-4dir'|: 'mob-static-4dir'/);
  const catalogSource = readFileSync(new URL('../src/combat/mobCatalog.ts', import.meta.url), 'utf8');
  const jsCatalog = ts.transpileModule(catalogSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { TEST_MOBS } = await import(`data:text/javascript;base64,${Buffer.from(jsCatalog).toString('base64')}`);
  assert.equal(TEST_MOBS.filter(m => m.tier !== 'boss').length, 15);
  assert.ok(TEST_MOBS.filter(m => m.tier !== 'boss').every(m => m.id in MOB_ROWS));
  // Rei Javali (tier 3) é um encontro de elite, não o boss Rei Javali Demoníaco.
  assert.ok(TEST_MOBS.some(m => m.id === 'mob-boar-king' && m.tier === 3));
  assert.ok(!TEST_MOBS.some(m => m.id === 'mob-boar-king' && m.tier === 'boss'));
});
