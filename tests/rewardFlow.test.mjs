import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const catalogURL = moduleURL('combat/guCatalog');
const mobURL = moduleURL('combat/mobCatalog');
const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const guStateURL = moduleURL('combat/guState', { './guCatalog': catalogURL });
const cultivationURL = moduleURL('entities/cultivation');
const balanceURL = moduleURL('entities/cultivationBalance');
const profileURL = moduleURL('entities/characterProfile');
const sessionURL = moduleURL('entities/characterCultivation', {
  './characterProfile': profileURL, './cultivationBalance': balanceURL,
  './cultivation': cultivationURL,
});
const flowURL = moduleURL('combat/rewardFlow', {
  './guCatalog': catalogURL,
  '../entities/cultivationBalance': balanceURL,
});

const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG } = await import(configURL);
const { GuStateStore } = await import(guStateURL);
const { CharacterCultivation } = await import(sessionURL);
const { TEST_MOBS } = await import(mobURL);
const {
  RewardQueue, MAX_REWARD_ATTEMPTS, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS, retryDelay,
} = await import(flowURL);

const mobOf = id => TEST_MOBS.find(mob => mob.id === id);

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data, failing: false,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: function set(key, value) {
      if (this.failing) throw new Error('cota esgotada');
      data.set(key, value);
    },
  };
};

const rewardEvent = (overrides = {}) => ({
  type: 'reward', targetId: 'alvo', stoneReward: 12, materialId: 'ruptura-rank-2',
  materialQuantity: 1, ...overrides,
});

/** Motor falso: controla o resultado de `claimWildGu` sem simular combate. */
const fakeEngine = (claimResults = []) => {
  const claims = [...claimResults];
  return {
    claims: [],
    persistence: true,
    claimWildGu(enemyId) {
      this.claims.push(enemyId);
      return claims.length > 0 ? claims.shift() : { ok: false, reason: 'sem Gu' };
    },
    disablePersistence() { this.persistence = false; },
  };
};

const fakeSink = ({ failTimes = 0 } = {}) => ({
  delivered: [], persistence: true, throws: failTimes,
  receiveLoot(stones, materialId, quantity) {
    if (this.throws > 0) { this.throws -= 1; throw new Error('sem espaço'); }
    this.delivered.push({ stones, materialId, quantity });
  },
  disablePersistence() { this.persistence = false; },
});

test('fila entrega Gu + pedras + material e limpa o pendente', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine([{ ok: true, guId: 'star-arrow' }]);
  const sink = fakeSink();
  queue.enqueue(rewardEvent({ guReward: 'star-arrow' }));

  const messages = queue.drain(engine, sink, 1000);
  assert.equal(queue.size, 0);
  assert.deepEqual(sink.delivered, [{ stones: 12, materialId: 'ruptura-rank-2', quantity: 1 }]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].kind, 'loot');
  assert.match(messages[0].text, /\+12 pedras espirituais/);
  assert.match(messages[0].text, /Rank 2/);
  assert.match(messages[0].text, /Flecha Estelar/);
  assert.equal(queue.failures, 0);
  assert.equal(queue.nextRetryAt, 0);
});

test('Gu recusado por inventário cheio não bloqueia pedras e material', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine([{ ok: false, reason: 'Inventário de Gu cheio.' }]);
  const sink = fakeSink();
  queue.enqueue(rewardEvent({ guReward: 'star-arrow' }));

  const messages = queue.drain(engine, sink, 0);
  assert.equal(sink.delivered.length, 1, 'os outros drops continuam entrando');
  assert.equal(queue.size, 0);
  assert.ok(messages.some(message => message.kind === 'gu-unclaimed'));
  assert.ok(messages.some(message => message.kind === 'loot'));
});

test('falha de gravação mantém a fila e usa backoff exponencial com teto', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine();
  const sink = fakeSink({ failTimes: 99 });
  queue.enqueue(rewardEvent());

  const delays = [];
  for (let attempt = 1; attempt < MAX_REWARD_ATTEMPTS; attempt += 1) {
    const messages = queue.drain(engine, sink, 10_000 * attempt);
    const retry = messages.find(message => message.kind === 'retry');
    assert.ok(retry, `tentativa ${attempt} deve agendar retry`);
    delays.push(retry.delayMs);
    assert.equal(queue.size, 1, 'a recompensa nunca é descartada');
    assert.equal(queue.failures, attempt);
    assert.equal(queue.nextRetryAt, 10_000 * attempt + retry.delayMs);
    // Só a primeira e a penúltima tentativa avisam no HUD.
    assert.equal(retry.notify, attempt === 1 || attempt === MAX_REWARD_ATTEMPTS - 1);
  }
  assert.deepEqual(delays, [2000, 4000, 8000, 16000].slice(0, MAX_REWARD_ATTEMPTS - 1));
  assert.equal(retryDelay(1), BASE_RETRY_DELAY_MS);
  assert.equal(retryDelay(9), MAX_RETRY_DELAY_MS, 'o atraso tem teto');
  assert.equal(retryDelay(0), BASE_RETRY_DELAY_MS, 'entrada inválida não quebra');
});

test('após o limite, desliga a persistência e entrega em memória', () => {
  const queue = new RewardQueue();
  // Falha de gravação reportada pelo motor (retryable) nas primeiras tentativas.
  const engine = fakeEngine([
    { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' },
    { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' },
    { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' },
    { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' },
    { ok: false, retryable: true, reason: 'Não foi possível salvar o Gu.' },
    { ok: true, guId: 'star-arrow' },
  ]);
  const sink = fakeSink();
  queue.enqueue(rewardEvent({ guReward: 'star-arrow' }));

  const messages = [];
  for (let attempt = 1; attempt < MAX_REWARD_ATTEMPTS; attempt += 1) {
    messages.push(...queue.drain(engine, sink, 1000 * attempt));
  }
  assert.equal(queue.isDegraded, false, 'ainda não degradou');
  assert.equal(engine.persistence, true);

  // Quinta falha: degrada, desliga a persistência dos dois lados e entrega em memória.
  messages.push(...queue.drain(engine, sink, 99_000));
  assert.equal(queue.isDegraded, true);
  assert.equal(engine.persistence, false);
  assert.equal(sink.persistence, false);
  assert.equal(queue.size, 0, 'a recompensa entra em memória');
  assert.equal(sink.delivered.length, 1);
  assert.ok(messages.some(message => message.kind === 'degraded'));
  assert.match(messages.find(message => message.kind === 'degraded').text, /não será salvo/);

  // Depois de degradar, o fluxo continua normal e sem novas tentativas.
  queue.enqueue(rewardEvent({ guReward: undefined }));
  const after = queue.drain(engine, sink, 120_000);
  assert.deepEqual(after.map(message => message.kind), ['loot']);
  assert.equal(queue.failures, 0);
});

test('degradado e ainda falhando: pausa a fila em vez de entrar em laço', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine();
  const sink = fakeSink({ failTimes: 1_000 });
  queue.enqueue(rewardEvent());

  for (let attempt = 1; attempt < MAX_REWARD_ATTEMPTS; attempt += 1) {
    queue.drain(engine, sink, 1000 * attempt);
  }
  queue.drain(engine, sink, 9000); // degrada
  const messages = queue.drain(engine, sink, 10_000);
  assert.equal(messages[0].kind, 'stalled');
  assert.deepEqual(messages[0].text, 'A recompensa não pôde ser entregue agora e continua na fila.');
  assert.equal(queue.size, 1, 'nada foi descartado');
  assert.equal(queue.nextRetryAt, 10_000 + MAX_RETRY_DELAY_MS);
});

test('integração: recompensa real com armazenamento cheio degrada sem perder o Gu', () => {
  const storage = memoryStorage();
  const engine = new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));
  const cultivationStorage = memoryStorage();
  const cultivation = new CharacterCultivation(cultivationStorage);

  const enemy = engine.addEnemy('alvo', 120, 100, 30, mobOf('mob-grey-wolf'),
    { forcedWildGu: 'bone-spear', random: undefined });
  enemy.health = 1;
  engine.select('alvo');
  const reward = engine.basicAttack(1000).events.find(event => event.type === 'reward');
  assert.equal(reward.guReward, 'bone-spear');

  storage.failing = true;
  cultivationStorage.failing = true;

  const queue = new RewardQueue();
  queue.enqueue(reward);
  const before = engine.inventoryCount('bone-spear');
  const messages = [];
  let now = 0;
  for (let attempt = 0; attempt < MAX_REWARD_ATTEMPTS; attempt += 1) {
    now += 1000;
    messages.push(...queue.drain(engine, cultivation, now));
  }

  assert.equal(queue.isDegraded, true, 'cinco falhas degradam');
  assert.equal(queue.size, 0, 'a recompensa foi entregue em memória');
  assert.equal(engine.inventoryCount('bone-spear'), before + 1, 'o Gu exato entrou');
  assert.equal(cultivation.state.spiritStones, mobOf('mob-grey-wolf').rewardStones);
  assert.equal(cultivation.state.materials[mobOf('mob-grey-wolf').rewardMaterialId], 1);
  assert.equal(engine.persistent, false, 'não tenta mais gravar');
  assert.equal(cultivation.persistent, false);
  assert.ok(messages.some(message => message.kind === 'degraded'));

  // Um novo drop na sessão degradada continua funcionando, só não persiste.
  queue.enqueue(rewardEvent({ guReward: undefined, stoneReward: 3, materialId: 'ruptura-rank-1' }));
  assert.deepEqual(queue.drain(engine, cultivation, now + 1).map(m => m.kind), ['loot']);
  assert.equal(cultivation.state.spiritStones, mobOf('mob-grey-wolf').rewardStones + 3);
});

test('evento sem alvo nem Gu não chama o motor e entrega só o loot', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine();
  const sink = fakeSink();
  queue.enqueue(rewardEvent({ targetId: undefined, stoneReward: 0, materialQuantity: 2 }));
  const messages = queue.drain(engine, sink, 0);
  assert.equal(engine.claims.length, 0);
  assert.deepEqual(sink.delivered, [{ stones: 0, materialId: 'ruptura-rank-2', quantity: 2 }]);
  assert.equal(messages[0].kind, 'loot');
  assert.match(messages[0].text, /Rank 2/);
  assert.doesNotMatch(messages[0].text, /\+0/, 'zero não aparece na mensagem');
});

test('fila preserva a ordem e drena vários eventos de uma vez', () => {
  const queue = new RewardQueue();
  const engine = fakeEngine([{ ok: true, guId: 'star-arrow' }]);
  const sink = fakeSink();
  queue.enqueue(rewardEvent({ guReward: 'star-arrow', stoneReward: 1 }));
  queue.enqueue(rewardEvent({ stoneReward: 2 }));
  queue.enqueue(rewardEvent({ stoneReward: 3 }));
  const messages = queue.drain(engine, sink, 0);
  assert.deepEqual(messages.map(message => message.kind), ['loot', 'loot', 'loot']);
  assert.deepEqual(sink.delivered.map(entry => entry.stones), [1, 2, 3]);
  assert.equal(queue.size, 0);
});

test('eventos que não são recompensa são ignorados pela fila', () => {
  const queue = new RewardQueue();
  queue.enqueue({ type: 'damage', amount: 5 });
  queue.enqueue({ type: 'defeat', targetId: 'x' });
  assert.equal(queue.size, 0);
});
