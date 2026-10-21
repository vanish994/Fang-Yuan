import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const catalogURL = moduleURL('combat/guCatalog');
const abilitiesURL = moduleURL('combat/enemyAbilities', {
  './guCatalog': catalogURL, './geometry': moduleURL('combat/geometry'),
  './wildGu': moduleURL('combat/wildGu', { './guCatalog': catalogURL }),
});

const { GU_CATALOG } = await import(catalogURL);
const { stepEnemyProjectiles, useWildGu, wildMeleeMultiplier } = await import(abilitiesURL);

/** Criatura mínima: só o que as habilidades realmente leem. */
function makeEnemy(overrides = {}) {
  return {
    id: 'mob-1', x: 0, y: 0, health: 100, maxHealth: 100, defense: 0, speed: 60,
    alive: true, lastAttackAt: 0, rewarded: false,
    wild: { gu: 'moonlight', casts: 0, nextAt: 0 }, ...overrides,
  };
}

function makeContext(overrides = {}) {
  const state = { engaged: 0, hits: [] };
  const ctx = {
    hero: { x: 100, y: 100, alive: true, maxHealth: 100 },
    shots: [],
    isFree: () => true,
    engage: () => { state.engaged += 1; },
    ...overrides,
  };
  return { ctx, state };
}

test('primeira ativação espera 900 ms e não gasta a recarga', () => {
  const enemy = makeEnemy({ wild: { gu: 'moonlight', casts: 0 } });
  const { ctx, state } = makeContext();
  assert.deepEqual(useWildGu(enemy, 5_000, ctx), []);
  assert.equal(enemy.wild.nextAt, 5_900);
  assert.equal(enemy.wild.casts, 0);
  assert.equal(ctx.shots.length, 0);
  assert.equal(state.engaged, 0);
});

test('projétil selvagem mira o herói fora do eixo e acerta', () => {
  const enemy = makeEnemy();
  const { ctx, state } = makeContext();
  const events = useWildGu(enemy, 1_000, ctx);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'enemy-ability');
  assert.equal(events[0].guId, 'moonlight');
  assert.equal(ctx.shots.length, 1);

  const shot = ctx.shots[0];
  // Mira vetorial: aponta para o herói, não em 4 direções cardeais.
  assert.ok(shot.dy > 0 && shot.dx > 0, `vetor de mira inesperado: ${shot.dx},${shot.dy}`);
  assert.ok(Math.abs(Math.hypot(shot.dx, shot.dy) - 1) < 1e-9);
  // a distância entre o heroi e o inimigo é diagonal: nenhum vetor cardeal puro
  assert.equal(enemy.wild.casts, 1);
  assert.equal(state.engaged, 1);

  const hits = [];
  for (let t = 0; t < 40 && ctx.shots.length > 0; t += 1) {
    stepEnemyProjectiles(ctx.shots, 1_000 + t * 100, 0.1, {
      hero: ctx.hero, isFree: () => true,
      hitHero: (damage, now, hitId) => { hits.push({ damage, now, hitId }); return []; },
    });
  }
  assert.equal(hits.length, 1, 'o projétil precisa acertar o alvo fora do eixo');
  assert.equal(hits[0].hitId, 'wild:mob-1:1');
  assert.equal(ctx.shots.length, 0);
});

test('projétil some na parede e no fim do alcance', () => {
  const shot = { enemyId: 'mob-1', guId: 'moonlight', x: 0, y: 0, dx: 1, dy: 0,
    traveled: 0, range: 60, speed: 100, damage: 5, hitId: 'x' };
  const shots = [shot];
  const before = shots.length;
  for (let t = 0; t < 10 && shots.length > 0; t += 1) {
    stepEnemyProjectiles(shots, 0, 0.1, {
      hero: { x: 500, y: 0 }, isFree: x => x < 20,
      hitHero: () => assert.fail('não deveria acertar o herói atrás da parede'),
    });
  }
  assert.equal(before, 1);
  assert.equal(shots.length, 0, 'projétil na parede é descartado');
});

test('projétil expira ao atingir o alcance máximo', () => {
  const shots = [{ enemyId: 'mob-1', guId: 'moonlight', x: 0, y: 0, dx: 1, dy: 0,
    traveled: 0, range: 20, speed: 100, damage: 5, hitId: 'x' }];
  for (let t = 0; t < 10 && shots.length > 0; t += 1) {
    stepEnemyProjectiles(shots, 0, 0.1, {
      hero: { x: 900, y: 0 }, isFree: () => true, hitHero: () => [],
    });
  }
  assert.equal(shots.length, 0);
});

test('investida não atravessa obstáculo', () => {
  const enemy = makeEnemy({ x: 0, y: 0, wild: { gu: 'whirlwind', casts: 0, nextAt: 0 } });
  const { ctx } = makeContext({ hero: { x: 100, y: 0, alive: true, maxHealth: 100 },
    isFree: x => x < 20 });
  const events = useWildGu(enemy, 1_000, ctx);
  assert.equal(events.length, 1);
  assert.ok(enemy.x <= 20, `avançou para dentro do obstáculo: ${enemy.x}`);
  assert.equal(enemy.y, 0);
  assert.equal(events[0].amount, enemy.x);
});

test('cura só quando a criatura está ferida e respeita o teto de vida', () => {
  const hurt = makeEnemy({ health: 20, wild: { gu: 'cleansing-water', casts: 0, nextAt: 0 } });
  const { ctx } = makeContext();
  const healed = useWildGu(hurt, 1_000, ctx);
  assert.deepEqual(healed.map(event => event.type), ['enemy-ability', 'heal']);
  assert.equal(hurt.health, 38);

  const healthy = makeEnemy({ health: 90, wild: { gu: 'cleansing-water', casts: 0, nextAt: 0 } });
  assert.deepEqual(useWildGu(healthy, 1_000, ctx), [], 'acima de 60% não cura');
  assert.equal(healthy.wild.nextAt, 0, 'recusa não consome a habilidade');
});

test('buff multiplica o corpo a corpo só durante a janela ativa', () => {
  const enemy = makeEnemy({ wild: { gu: 'little-light', casts: 0, nextAt: 0 } });
  const { ctx } = makeContext({ hero: { x: 60, y: 0, alive: true, maxHealth: 100 } });
  assert.equal(wildMeleeMultiplier(enemy, 1_000), 1);
  useWildGu(enemy, 1_000, ctx);
  const buff = GU_CATALOG['little-light'].active;
  assert.equal(wildMeleeMultiplier(enemy, 1_001), 1 + (buff.damageMultiplier - 1));
  assert.equal(wildMeleeMultiplier(enemy, 1_000 + buff.durationMs + 1), 1);
});

test('cada ativação agenda a própria recarga e não repete no mesmo instante', () => {
  const enemy = makeEnemy();
  const { ctx } = makeContext();
  useWildGu(enemy, 1_000, ctx);
  const nextAt = enemy.wild.nextAt;
  assert.ok(nextAt > 1_000);
  const before = ctx.shots.length;
  assert.deepEqual(useWildGu(enemy, 1_000, ctx), []);
  assert.equal(ctx.shots.length, before);
  assert.equal(enemy.wild.nextAt, nextAt);
});

test('Gu puramente passivo nunca gera evento de habilidade', () => {
  const enemy = makeEnemy({ wild: { gu: 'stone-skin', casts: 0, nextAt: 0 } });
  const { ctx, state } = makeContext();
  assert.deepEqual(useWildGu(enemy, 1_000, ctx), []);
  assert.equal(enemy.wild.nextAt, 0);
  assert.equal(enemy.wild.casts, 0);
  assert.equal(state.engaged, 0);
});

test('criatura morta (herói caído) não usa Gu e criatura cega também não', () => {
  const dead = makeEnemy();
  const { ctx } = makeContext({ hero: { x: 100, y: 100, alive: false, maxHealth: 100 } });
  assert.deepEqual(useWildGu(dead, 1_000, ctx), []);
  assert.equal(ctx.shots.length, 0);

  const plain = makeEnemy({ wild: undefined });
  assert.deepEqual(useWildGu(plain, 1_000, makeContext().ctx), []);
});
