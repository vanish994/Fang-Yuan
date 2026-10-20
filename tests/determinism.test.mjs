import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const guStateURL = moduleURL('combat/guState', { './guCatalog': moduleURL('combat/guCatalog') });
const mobURL = moduleURL('combat/mobCatalog');

const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG } = await import(configURL);
const { GuStateStore } = await import(guStateURL);
const { TEST_MOBS } = await import(mobURL);

const mobOf = id => TEST_MOBS.find(mob => mob.id === id);

/** Armazenamento isolado: nenhum teste toca o localStorage real. */
const memoryStorage = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

/** PRNG determinístico (mulberry32): mesma seed, mesma sequência. */
const seeded = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const build = (random) => new CombatEngine(
  COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(memoryStorage()), random);

/** Monta um cenário com matilha e roda N ticks; devolve um retrato observável. */
const runScenario = (seed, ticks = 400) => {
  const engine = build(seeded(seed));
  engine.addEnemy('lobo', 170, 110, 55, mobOf('mob-grey-wolf'));
  engine.addEnemy('javali', 220, 140, 45, mobOf('mob-wild-boar'));
  const events = [];
  for (let i = 0; i < ticks; i += 1) events.push(...engine.tick(1000 + i * 100, 100));
  return {
    positions: [...engine.enemies.values()].map(enemy =>
      `${enemy.id}:${enemy.x.toFixed(2)},${enemy.y.toFixed(2)},${enemy.health}`),
    heroHealth: engine.hero.health,
    types: events.map(event => event.type).join(','),
  };
};

test('mesma seed reproduz exatamente a mesma simulação', () => {
  for (const seed of [1, 7, 1234]) {
    assert.deepEqual(runScenario(seed), runScenario(seed), `seed ${seed}`);
  }
});

test('seeds diferentes produzem histórias diferentes', () => {
  const a = runScenario(1);
  const b = runScenario(2);
  assert.notDeepEqual(a, b, 'a aleatoriedade continua existindo quando a seed muda');
  // E a diferença é real em algo observável, não só na ordem de eventos.
  assert.ok(a.positions.join() !== b.positions.join() || a.heroHealth !== b.heroHealth);
});

test('sem RNG injetado o motor mantém o comportamento anterior', () => {
  const engine = build(undefined);
  // Criatura sem opção explícita continua nascendo sem Gu (determinístico).
  const plain = engine.addEnemy('sem-gu', 300, 300, 45, mobOf('mob-wild-boar'));
  assert.equal(plain.wildGu, null);
  // E o motor ainda funciona com Math.random por padrão.
  const events = [];
  for (let i = 0; i < 60; i += 1) events.push(...engine.tick(1000 + i * 100, 100));
  assert.ok(Array.isArray(events));
});

test('RNG injetado também governa o sorteio do Gu selvagem', () => {
  // random() = 0 passa em qualquer chance e escolhe o primeiro do pool.
  const lucky = build(() => 0);
  const enemy = lucky.addEnemy('sortudo', 300, 300, 45, mobOf('mob-wild-boar'));
  assert.ok(enemy.wildGu, 'com RNG injetado o nascimento sorteia');

  // Sem RNG e sem opção explícita: nasce sem Gu.
  assert.equal(build(undefined).addEnemy('sem-rng', 300, 300, 45, mobOf('mob-wild-boar')).wildGu, null);

  // RNG determinístico: a mesma seed concede o mesmo Gu em cada spawn.
  const first = build(seeded(99)).addEnemy('a', 300, 300, 45, mobOf('mob-wild-boar'));
  const second = build(seeded(99)).addEnemy('a', 300, 300, 45, mobOf('mob-wild-boar'));
  assert.equal(first.wildGu, second.wildGu);
});

test('revive da Cigarra usa o RNG do motor', () => {
  // chance 5%: com random() = 0 a ressurreição sempre acontece.
  const engine = build(() => 0);
  const events = engine.hitHero(1_000, 500, 'golpe-letal');
  assert.ok(events.some(event => event.type === 'resurrect'));
  assert.equal(engine.hero.alive, true);

  // Com random() = 0.99 a Cigarra nunca dispara.
  const doomed = build(() => 0.99);
  const death = doomed.hitHero(1_000, 500, 'golpe-letal');
  assert.ok(death.some(event => event.type === 'hero-death'));
  assert.equal(doomed.hero.alive, false);
});

test('RNG explícito por golpe continua tendo prioridade sobre o do motor', () => {
  const engine = build(() => 0); // motor sempre ressuscitaria
  const events = engine.hitHero(1_000, 400, 'golpe', () => 0.99);
  assert.ok(events.some(event => event.type === 'hero-death'), 'a função passada vence');
});

test('RNG injetado não vaza para o save nem para o estado do jogador', () => {
  const storage = memoryStorage();
  const engine = new CombatEngine(COMBAT_CONFIG, 100, 100, undefined,
    new GuStateStore(storage), seeded(5));
  engine.addEnemy('lobo', 170, 110, 55, mobOf('mob-grey-wolf'));
  for (let i = 0; i < 40; i += 1) engine.tick(1000 + i * 100, 100);
  // Uma troca de equipamento força uma gravação (o tick sozinho não grava).
  assert.equal(engine.equip('passive', 'stone-skin', 99_000).ok, true);
  const snapshot = JSON.stringify({ inventory: engine.inventory, equipment: engine.equipment });
  assert.doesNotMatch(snapshot, /function|mulberry|seed/i, 'nada de RNG é serializado');
  // O save gravado também não carrega a fonte de aleatoriedade.
  assert.ok(storage.data.size > 0, 'o cenário grava alguma coisa');
  assert.doesNotMatch([...storage.data.values()].join(''), /function|mulberry|seed/i);
});

test('a mesma seed dá a mesma sequência de decisões com Gu selvagem em jogo', () => {
  const withGu = (seed) => {
    const engine = build(seeded(seed));
    const enemy = engine.addEnemy('lobo', 200, 100, 90, mobOf('mob-grey-wolf'),
      { forcedWildGu: 'whirlwind' });
    const log = [];
    for (let i = 0; i < 200; i += 1) {
      for (const event of engine.tick(1000 + i * 50, 50)) {
        if (event.type === 'enemy-ability') log.push(`${event.guId}@${i}`);
      }
    }
    return { log, x: enemy.x.toFixed(2), y: enemy.y.toFixed(2), casts: enemy.wildGuCasts };
  };
  assert.deepEqual(withGu(3), withGu(3));
  assert.ok(withGu(3).log.length >= 1, 'a investida precisa acontecer no cenário');
});
