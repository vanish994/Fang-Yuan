import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const catalogURL = moduleURL('combat/guCatalog');
const mobURL = moduleURL('combat/mobCatalog');
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
const { GuStateStore } = await import(guStateURL);
const { TEST_MOBS } = await import(mobURL);
const { CharacterCultivation, CULTIVATION_STORAGE_KEY } = await import(sessionURL);

const mobOf = id => TEST_MOBS.find(mob => mob.id === id);

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

/** Mata a criatura sem depender de HP/simulação: só o evento de recompensa importa. */
const rewardOf = (engine, mob) => {
  const enemy = engine.addEnemy('alvo', 120, 100, mob?.health ?? 10, mob, { forcedWildGu: null });
  enemy.health = 1;
  engine.select('alvo');
  return engine.basicAttack(1000).events.filter(event => event.type === 'reward')[0];
};

test('cada criatura entrega o loot do próprio Rank, não um valor fixo', () => {
  const cases = ['mob-wild-boar', 'mob-fierce-wolf', 'mob-boar-king', 'mob-ancient-demonic-beast'];
  const rewards = cases.map(id => ({ id, mob: mobOf(id), reward: rewardOf(make(), mobOf(id)) }));

  for (const { id, mob, reward } of rewards) {
    assert.equal(reward.stoneReward, mob.rewardStones, `${id}: pedras do catálogo`);
    assert.equal(reward.materialId, mob.rewardMaterialId, `${id}: material do catálogo`);
    assert.equal(reward.materialQuantity, mob.rewardMaterialQuantity, `${id}: quantidade`);
  }

  // A curva existe de verdade: o chefe de Rank 4 paga muito mais que o Rank 1.
  const boar = rewards[0].reward.stoneReward;
  const beast = rewards[3].reward.stoneReward;
  assert.ok(beast > boar * 10, `chefe (${beast}) deve superar o javali (${boar})`);
  assert.notEqual(rewards[0].reward.materialId, rewards[1].reward.materialId,
    'materiais acompanham o Rank');
});

test('inimigo sem catálogo de mob continua usando o loot de configuração', () => {
  const engine = make();
  const reward = rewardOf(engine, undefined);
  assert.equal(reward.stoneReward, COMBAT_CONFIG.enemy.lootStones);
  assert.equal(reward.materialId, COMBAT_CONFIG.enemy.lootMaterialId);
});

test('recompensa aceita zero em um dos lados e recusa recompensa vazia', () => {
  const storage = memoryStorage();
  const session = new CharacterCultivation(storage);

  session.receiveLoot(0, 'ruptura-rank-2', 2);
  assert.equal(session.state.spiritStones, 0);
  assert.equal(session.state.materials['ruptura-rank-2'], 2);

  session.receiveLoot(30, 'ruptura-rank-2', 0);
  assert.equal(session.state.spiritStones, 30);
  assert.equal(session.state.materials['ruptura-rank-2'], 2, 'material zerado não altera a pilha');
  assert.equal(Object.keys(session.state.materials).length, 1, 'não cria chave vazia');

  // Nada para receber é erro de programação, não recompensa válida.
  assert.throws(() => session.receiveLoot(0, 'ruptura-rank-1', 0), RangeError);
  // Valores negativos e não inteiros continuam recusados.
  assert.throws(() => session.receiveLoot(-1, 'ruptura-rank-1', 1), RangeError);
  assert.throws(() => session.receiveLoot(1, 'ruptura-rank-1', -1), RangeError);
  assert.throws(() => session.receiveLoot(1, 'ID INVÁLIDO', 1), RangeError);
});
