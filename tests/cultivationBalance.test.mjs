import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';

const profileURL = moduleURL('entities/characterProfile');
const balanceURL = moduleURL('entities/cultivationBalance');
const cultivationURL = moduleURL('entities/cultivation');
const sessionURL = moduleURL('entities/characterCultivation', {
  './characterProfile': profileURL,
  './cultivationBalance': balanceURL,
  './cultivation': cultivationURL,
});
const { CharacterCultivation, CULTIVATION_STORAGE_KEY, TEST_STONE_GRANT } = await import(sessionURL);
const { CULTIVATION_RULES, breakthroughMaterialId, breakthroughMaterialName } =
  await import(balanceURL);

test('tabela aprovada cobre exatamente nove Ranks e os oito limites entre Ranks', () => {
  const rows = [
    [20, 35, 55, 90, .80, .10], [45, 75, 115, 180, .75, .15],
    [90, 150, 230, 360, .70, .20], [180, 300, 460, 720, .65, .25],
    [360, 600, 920, 1440, .60, .30], [720, 1200, 1840, 2880, .55, .35],
    [1440, 2400, 3680, 5760, .50, .40], [2880, 4800, 7360, 11520, .45, .45],
    [5760, 9600, 14720],
  ];
  assert.equal(Object.keys(CULTIVATION_RULES.stageCosts).length, 9);
  assert.equal(Object.keys(CULTIVATION_RULES.rankCosts).length, 8);
  rows.forEach(([initial, middle, superior, stones, success, loss], index) => {
    const rank = index + 1;
    assert.deepEqual(CULTIVATION_RULES.stageCosts[rank], {
      Inicial: initial, Médio: middle, Superior: superior,
    });
    assert.ok(initial < middle && middle < superior);
    if (rank === 9) { assert.equal(CULTIVATION_RULES.rankCosts[rank], undefined); return; }
    assert.deepEqual(CULTIVATION_RULES.rankCosts[rank], {
      stones, successChance: success, materialLossChance: loss,
      materials: [{ id: breakthroughMaterialId(rank), quantity: rank }],
    });
    assert.match(breakthroughMaterialName(rank), new RegExp(`Rank ${rank}$`));
  });
});

test('crédito de teste dá 1 milhão uma vez a saves novos e antigos, sem afetar cultivo ou drops', () => {
  assert.equal(TEST_STONE_GRANT, 1_000_000);
  const storage = memoryStorage();
  const newGame = new CharacterCultivation(storage);
  assert.equal(newGame.state.spiritStones, 0); // regra-base permanece sem recursos gratuitos.
  assert.equal(newGame.grantTestStonesOnce(), true);
  assert.equal(newGame.state.spiritStones, TEST_STONE_GRANT);
  assert.equal(newGame.hasTestStones, true);
  assert.equal(newGame.grantTestStonesOnce(), false);
  assert.equal(new CharacterCultivation(storage).grantTestStonesOnce(), false);
  newGame.advance();
  assert.equal(new CharacterCultivation(storage).state.spiritStones, TEST_STONE_GRANT - 20);
  assert.equal(new CharacterCultivation(storage).grantTestStonesOnce(), false);

  const oldSave = memoryStorage();
  oldSave.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
    state: { rank: 2, stage: 'Médio', spiritStones: 47,
      materials: { 'ruptura-rank-1': 3 } } }));
  const migrated = new CharacterCultivation(oldSave);
  assert.equal(migrated.grantTestStonesOnce(), true);
  assert.deepEqual(migrated.state, { rank: 2, stage: 'Médio', spiritStones: TEST_STONE_GRANT + 47,
    materials: { 'ruptura-rank-1': 3 } });
  assert.equal(new CharacterCultivation(oldSave).grantTestStonesOnce(), false);
  const saved = JSON.parse(oldSave.getItem(CULTIVATION_STORAGE_KEY));
  assert.equal(saved.testStonesGranted, true); // saldo e marca gravados no mesmo save.
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /this\.cultivation = new CharacterCultivation\(\);\s*this\.cultivation\.grantTestStonesOnce\(\);/);
});

test('sem localStorage gravável o crédito de teste funciona só nesta sessão', () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('bloqueado'); };
  const session = new CharacterCultivation(storage);
  assert.equal(session.grantTestStonesOnce(), true);
  assert.equal(session.state.spiritStones, TEST_STONE_GRANT);
  assert.equal(session.persistent, false);
  assert.equal(session.grantTestStonesOnce(), false);
  session.advance();
  assert.equal(session.state.spiritStones, TEST_STONE_GRANT - 20);
});

test('ficha parte com zero recursos e mostra próximo custo; avanços usam o modelo real', () => {
  const cultivation = new CharacterCultivation();
  assert.deepEqual(cultivation.state, { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} });
  assert.deepEqual(cultivation.requirement, { kind: 'stage', nextStage: 'Médio',
    stones: 20, missingStones: 20, canAdvance: false });
  assert.equal(cultivation.advance().status, 'insufficient-stones');
  cultivation.receiveStones(20);
  assert.equal(cultivation.requirement.canAdvance, true);
  assert.equal(cultivation.advance().status, 'advanced');
  assert.deepEqual(cultivation.state, { rank: 1, stage: 'Médio', spiritStones: 0, materials: {} });
  cultivation.receiveStones(35);
  cultivation.advance();
  cultivation.receiveStones(55);
  cultivation.advance();
  assert.deepEqual(cultivation.requirement, { kind: 'rank', stones: 90,
    materials: [{ id: 'ruptura-rank-1', quantity: 1 }], successChance: .8,
    materialLossChance: .1, missingStones: 90,
    missingMaterials: [{ id: 'ruptura-rank-1', quantity: 1 }], canAdvance: false });
  cultivation.receiveStones(90);
  assert.equal(cultivation.requirement.canAdvance, false);
  cultivation.receiveMaterial(breakthroughMaterialId(1), 1);
  assert.equal(cultivation.requirement.canAdvance, true);
  assert.equal(cultivation.advance(cultivation.revision, () => .2).status, 'advanced');
  assert.deepEqual(cultivation.state, { rank: 2, stage: 'Inicial', spiritStones: 0,
    materials: { 'ruptura-rank-1': 0 } });
  const snapshot = cultivation.state;
  snapshot.materials['ruptura-rank-1'] = 99;
  assert.equal(cultivation.state.materials['ruptura-rank-1'], 0);
  assert.throws(() => cultivation.receiveStones(-1), RangeError);
  assert.throws(() => cultivation.receiveMaterial('', 1), RangeError);
});

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    data,
  };
}

test('estado de Rank, estágio, pedras e materiais persiste após recarga', () => {
  const storage = memoryStorage();
  const first = new CharacterCultivation(storage);
  first.receiveStones(120);
  first.receiveMaterial(breakthroughMaterialId(1), 3);
  const revision = first.revision;
  assert.equal(first.advance(revision).status, 'advanced');
  assert.equal(first.advance(revision).status, 'stale'); // mesmo clique nunca avança duas vezes
  assert.deepEqual(first.state, { rank: 1, stage: 'Médio', spiritStones: 100,
    materials: { 'ruptura-rank-1': 3 } });
  assert.equal(JSON.parse(storage.getItem(CULTIVATION_STORAGE_KEY)).version, 1);
  const reloaded = new CharacterCultivation(storage);
  assert.deepEqual(reloaded.state, first.state);
  reloaded.advance(reloaded.revision);
  assert.deepEqual(new CharacterCultivation(storage).state, { rank: 1, stage: 'Superior',
    spiritStones: 65, materials: { 'ruptura-rank-1': 3 } });
});

test('falha de armazenamento não gasta recursos; save corrompido não injeta Rank 10', () => {
  const storage = memoryStorage();
  const cultivation = new CharacterCultivation(storage);
  storage.setItem = () => { throw new Error('Armazenamento bloqueado'); };
  assert.throws(() => cultivation.receiveStones(20));
  assert.deepEqual(cultivation.state, { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} });
  const funded = memoryStorage();
  funded.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
    state: { rank: 1, stage: 'Inicial', spiritStones: 20, materials: {} } }));
  const ready = new CharacterCultivation(funded);
  funded.setItem = () => { throw new Error('Disco cheio'); };
  assert.throws(() => ready.advance(ready.revision), /Disco cheio/);
  assert.deepEqual(ready.state, { rank: 1, stage: 'Inicial', spiritStones: 20, materials: {} });
  const good = memoryStorage();
  good.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
    state: { rank: 10, stage: 'Inicial', spiritStones: 99999, materials: {} } }));
  assert.deepEqual(new CharacterCultivation(good).state, { rank: 1, stage: 'Inicial',
    spiritStones: 0, materials: {} });
  good.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
    state: { rank: 9, stage: 'Pico', spiritStones: 20, materials: {} } }));
  const maximum = new CharacterCultivation(good);
  assert.equal(maximum.requirement.kind, 'maximum');
  assert.equal(maximum.advance().status, 'maximum');
  assert.equal(maximum.state.rank, 9);
});

test('persistência de ruptura mal-sucedida mantém perda de pedras e perda configurada de materiais', () => {
  const storage = memoryStorage();
  storage.setItem(CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
    state: { rank: 1, stage: 'Pico', spiritStones: 90,
      materials: { 'ruptura-rank-1': 1 } } }));
  const cultivation = new CharacterCultivation(storage);
  const rolls = [0.99, 0.01];
  const result = cultivation.advance(cultivation.revision, () => rolls.shift());
  assert.equal(result.status, 'failed');
  assert.deepEqual(new CharacterCultivation(storage).state, {
    rank: 1, stage: 'Pico', spiritStones: 0, materials: { 'ruptura-rank-1': 0 },
  });
});
