import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entities/cultivation.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { MAX_RANK, STAGES, attemptAdvance } =
  await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

// Valores apenas das provas unitárias: não representam custos de balanceamento do jogo.
const rules = {
  stageCosts: { 1: { Inicial: 10, Médio: 20, Superior: 30 } },
  rankCosts: { 1: { stones: 50, materials: [{ id: 'drop-de-inimigo', quantity: 2 }],
    successChance: 0.4, materialLossChance: 0.25 } },
};
const initial = { rank: 1, stage: 'Inicial', spiritStones: 100,
  materials: { 'drop-de-inimigo': 5 } };

test('nove Ranks × quatro estágios, subida de estágio gasta pedras sem sorteio', () => {
  assert.equal(MAX_RANK, 9);
  assert.deepEqual(STAGES, ['Inicial', 'Médio', 'Superior', 'Pico']);
  const neverRandom = () => { throw new Error('Subida de estágio não sorteia falha'); };
  const first = attemptAdvance(initial, rules, neverRandom);
  assert.deepEqual(first, { status: 'advanced', state: { ...initial, stage: 'Médio', spiritStones: 90 } });
  const second = attemptAdvance(first.state, rules, neverRandom);
  assert.equal(second.state.stage, 'Superior');
  assert.equal(second.state.spiritStones, 70);
  const third = attemptAdvance(second.state, rules, neverRandom);
  assert.equal(third.state.stage, 'Pico');
  assert.equal(third.state.spiritStones, 40);
  assert.deepEqual(initial.materials, { 'drop-de-inimigo': 5 });
});

test('sem pedras, materiais ou parâmetros não permite avançar nem consumir recursos', () => {
  const low = { ...initial, spiritStones: 9 };
  assert.deepEqual(attemptAdvance(low, rules), { status: 'insufficient-stones', state: low });
  assert.deepEqual(attemptAdvance(initial, { stageCosts: {}, rankCosts: {} }),
    { status: 'unconfigured', state: initial });
  const peak = { ...initial, stage: 'Pico', spiritStones: 49 };
  assert.deepEqual(attemptAdvance(peak, rules), { status: 'insufficient-stones', state: peak });
  const noDrop = { ...peak, spiritStones: 60, materials: {} };
  assert.deepEqual(attemptAdvance(noDrop, rules), { status: 'missing-materials', state: noDrop });
});

test('ruptura bem-sucedida consome pedras e materiais e inicia o próximo Rank', () => {
  const peak = { ...initial, stage: 'Pico' };
  const result = attemptAdvance(peak, rules, () => 0.2);
  assert.deepEqual(result, { status: 'advanced', state: {
    rank: 2, stage: 'Inicial', spiritStones: 50, materials: { 'drop-de-inimigo': 3 },
  } });
  assert.equal(peak.spiritStones, 100);
  assert.equal(peak.materials['drop-de-inimigo'], 5);
});

test('falha sempre consome pedras; perda é sorteada individualmente por material', () => {
  const peak = { ...initial, stage: 'Pico', materials: {
    'drop-de-inimigo': 5, 'outro-drop': 3,
  } };
  const multiRules = { ...rules, rankCosts: { 1: { ...rules.rankCosts[1], materials: [
    { id: 'drop-de-inimigo', quantity: 2 }, { id: 'outro-drop', quantity: 1 },
  ] } } };
  const failed = attemptAdvance(peak, multiRules, sequentialRolls(0.8, 0.1, 0.9));
  assert.deepEqual(failed, { status: 'failed', lostMaterials: { 'drop-de-inimigo': 2 }, state: {
    ...peak, spiritStones: 50, materials: { 'drop-de-inimigo': 3, 'outro-drop': 3 },
  } });
  const kept = attemptAdvance(peak, multiRules, sequentialRolls(0.8, 0.9, 0.9));
  assert.deepEqual(kept, { status: 'failed', lostMaterials: {}, state: {
    ...peak, spiritStones: 50, materials: { 'drop-de-inimigo': 5, 'outro-drop': 3 },
  } });
  // Falhar não altera a chance da próxima tentativa nem o requisito do Rank.
  assert.deepEqual(attemptAdvance(kept.state, multiRules, sequentialRolls(0.2)), {
    status: 'advanced', state: { rank: 2, stage: 'Inicial', spiritStones: 0,
      materials: { 'drop-de-inimigo': 3, 'outro-drop': 2 } },
  });
});

function sequentialRolls(...values) {
  let index = 0;
  return () => values[index++];
}

test('limite e validação impedem custo regressivo, chance inválida e estado impossível', () => {
  const peak = { ...initial, stage: 'Pico' };
  assert.deepEqual(attemptAdvance({ ...peak, rank: 9 }, { stageCosts: {}, rankCosts: {} }),
    { status: 'maximum', state: { ...peak, rank: 9 } });
  assert.throws(() => attemptAdvance({ ...initial, rank: 10 }, rules), RangeError);
  assert.throws(() => attemptAdvance({ ...initial, spiritStones: -1 }, rules), RangeError);
  assert.throws(() => attemptAdvance(initial,
    { ...rules, stageCosts: { 1: { Inicial: 10, Médio: 9 } } }), RangeError);
  assert.throws(() => attemptAdvance(peak,
    { ...rules, rankCosts: { 1: { ...rules.rankCosts[1], successChance: 1.5 } } }), RangeError);
  assert.throws(() => attemptAdvance(peak, rules, () => NaN), RangeError);
});
