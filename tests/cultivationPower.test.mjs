import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entities/cultivationPower.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleURL = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const { CULTIVATION_POWER_CURVE, cultivationPower } = await import(moduleURL);

assert.equal(CULTIVATION_POWER_CURVE.length, 36);
assert.equal(new Set(CULTIVATION_POWER_CURVE.map((row) => `${row.rank}:${row.stage}`)).size, 36);

for (let rank = 1; rank <= 9; rank += 1) {
  const rows = CULTIVATION_POWER_CURVE.filter((row) => row.rank === rank);
  assert.equal(rows.length, 4);
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(rows[index].power > rows[index - 1].power);
  }
}

assert.equal(cultivationPower(1, 'Inicial').power, 1);
assert.equal(cultivationPower(9, 'Pico').power, 14.2);
assert.throws(() => cultivationPower(10, 'Inicial'));
