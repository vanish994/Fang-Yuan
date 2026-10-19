import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/ui/advanceIntent.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { AdvanceIntent } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('requisitos visíveis antes da confirmação; cliques repetidos não disparam dois gastos', () => {
  const intent = new AdvanceIntent();
  assert.deepEqual(intent.press(false, 0), { kind: 'blocked' });
  assert.deepEqual(intent.press(true, 2), { kind: 'confirm' });
  assert.deepEqual(intent.press(true, 2), { kind: 'attempt', revision: 2 });
  assert.deepEqual(intent.press(true, 3), { kind: 'review' });
  assert.deepEqual(intent.press(true, 3), { kind: 'confirm' });
  assert.deepEqual(intent.press(true, 3), { kind: 'attempt', revision: 3 });
});

test('confirmação obsoleta não gasta recursos depois de mudança na sessão', () => {
  const intent = new AdvanceIntent();
  intent.press(true, 0);
  assert.deepEqual(intent.press(true, 1), { kind: 'review' });
  intent.press(true, 1);
  intent.resetIfStale(2);
  assert.equal(intent.phase, 'review');
});
