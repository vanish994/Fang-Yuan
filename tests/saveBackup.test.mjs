import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const catalogURL = moduleURL('combat/guCatalog');
const guStateURL = moduleURL('combat/guState', { './guCatalog': catalogURL });
const cultivationURL = moduleURL('entities/cultivation');
const balanceURL = moduleURL('entities/cultivationBalance');
const profileURL = moduleURL('entities/characterProfile');
const sessionURL = moduleURL('entities/characterCultivation', {
  './characterProfile': profileURL, './cultivationBalance': balanceURL,
  './cultivation': cultivationURL,
});

const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG } = await import(configURL);
const { GuStateStore, GU_STATE_STORAGE_KEY } = await import(guStateURL);
const { CharacterCultivation, CULTIVATION_STORAGE_KEY } = await import(sessionURL);

/** Armazenamento em memória; nenhum teste toca o localStorage real. */
const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, value); },
  };
};

const make = (storage = memoryStorage()) =>
  new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));

test('save de Gu ilegível é copiado para backup antes de ser sobrescrito', () => {
  const broken = '{"version":1,"inventory":{'; // JSON truncado
  const storage = memoryStorage({ [GU_STATE_STORAGE_KEY]: broken });
  const engine = new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));

  // O jogo segue com o estado padrão…
  assert.ok(engine.inventoryCount('moonlight') > 0);
  assert.equal(storage.getItem(`${GU_STATE_STORAGE_KEY}.backup`), broken,
    'o conteúdo original precisa sobreviver à primeira gravação');
  assert.equal(storage.getItem(GU_STATE_STORAGE_KEY), broken, 'nada é apagado na leitura');

  // …e a primeira escrita válida preserva o backup.
  engine.equip('passive', 'stone-skin', 0);
  assert.equal(storage.getItem(`${GU_STATE_STORAGE_KEY}.backup`), broken);
  assert.equal(JSON.parse(storage.getItem(GU_STATE_STORAGE_KEY)).version, 1);
});

test('save de versão futura é preservado em backup (Gu e cultivo)', () => {
  const future = JSON.stringify({ version: 99, inventory: { moonlight: 5 } });
  const guStorage = memoryStorage({ [GU_STATE_STORAGE_KEY]: future });
  new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(guStorage));
  assert.equal(guStorage.getItem(`${GU_STATE_STORAGE_KEY}.backup`), future,
    'versão desconhecida não pode ser destruída silenciosamente');

  const futureCultivation = JSON.stringify({ version: 99, state: { rank: 3, stage: 'Pico' } });
  const cultivationStorage = memoryStorage({ [CULTIVATION_STORAGE_KEY]: futureCultivation });
  const session = new CharacterCultivation(cultivationStorage);
  assert.equal(session.state.rank, 1, 'o jogo volta ao estado padrão em memória');
  assert.equal(cultivationStorage.getItem(`${CULTIVATION_STORAGE_KEY}.backup`), futureCultivation);
});

test('o backup guarda o original mesmo com várias leituras do save quebrado', () => {
  const first = '{"version":1, quebrado';
  const storage = memoryStorage({ [GU_STATE_STORAGE_KEY]: first });
  new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));

  // Uma segunda sessão grava por cima da chave principal; o backup não muda.
  new GuStateStore(storage).save({ inventory: {}, equipment: {
    attack: null, passive: null, movement: null, support: null }, assimilated: [] });
  new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));
  assert.equal(storage.getItem(`${GU_STATE_STORAGE_KEY}.backup`), first);
});

test('save íntegro não gera backup nem é modificado na leitura', () => {
  const storage = memoryStorage();
  const engine = make(storage);
  engine.equip('passive', 'stone-skin', 0);
  const saved = storage.getItem(GU_STATE_STORAGE_KEY);
  new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));
  assert.equal(storage.getItem(GU_STATE_STORAGE_KEY), saved);
  assert.equal(storage.getItem(`${GU_STATE_STORAGE_KEY}.backup`), null);
});
