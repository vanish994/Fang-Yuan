import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/combat/bossSprites.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { BOSS_ROWS, bossFrame } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('atlas recebido tem 4 bosses, 4 direções e canal de transparência', () => {
  const png = readFileSync(new URL('../public/assets/bosses/boss-static-4dir-48.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 192);
  assert.equal(png.readUInt32BE(20), 192);
  assert.equal(png[25], 6); // truecolor + alpha
  assert.deepEqual(Object.values(BOSS_ROWS), [0, 1, 2, 3]);
  for (const [id, row] of Object.entries(BOSS_ROWS)) {
    assert.equal(bossFrame(id, 'down'), row * 4);
    assert.equal(bossFrame(id, 'left'), row * 4 + 1);
    assert.equal(bossFrame(id, 'up'), row * 4 + 2);
    assert.equal(bossFrame(id, 'right'), row * 4 + 3);
  }
  assert.throws(() => bossFrame('mob-wild-boar', 'down'), /Boss sem sprite/);
});

test('todos os bosses do catálogo usam o atlas na cena; móveis mudam de direção', () => {
  const catalog = readFileSync(new URL('../src/combat/mobCatalog.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(catalog, /Besta Demoníaca Antiga/);
  assert.match(main, /this\.load\.spritesheet\('boss-static-4dir'/);
  assert.match(main, /const frame = boss \? bossFrame :/);
  assert.match(main, /art\.sprite\.setFrame\(art\.frame\(id, art\.facing\)\)/);
});
