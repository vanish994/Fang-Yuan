import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleURL } from './support/tsModule.mjs';

const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const { cardinalStep } = await import(moduleURL('combat/enemyMovement'));
const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG } = await import(configURL);

const make = (overrides = {}) => new CombatEngine({ ...COMBAT_CONFIG, ...overrides }, 100, 100);

test('passo cardinal anda num eixo por vez, sem diagonal e sem passar do alvo', () => {
  const free = () => true;
  // Diagonal: o eixo dominante (x) anda primeiro e o y fica intacto.
  const slanted = cardinalStep({ x: 0, y: 0 }, { x: 40, y: 10 }, 5, free);
  assert.deepEqual(slanted, { x: 5, y: 0, moved: true, axis: 'x' });
  // Eixo já alinhado: anda só nele.
  const vertical = cardinalStep({ x: 0, y: 0 }, { x: 0, y: -30 }, 5, free);
  assert.deepEqual(vertical, { x: 0, y: -5, moved: true, axis: 'y' });
  // Passo maior que a distância não ultrapassa o alvo.
  const near = cardinalStep({ x: 0, y: 0 }, { x: 3, y: 0 }, 20, free);
  assert.deepEqual(near, { x: 3, y: 0, moved: true, axis: 'x' });
  // Sem passo, não anda.
  assert.equal(cardinalStep({ x: 0, y: 0 }, { x: 40, y: 0 }, 0, free).moved, false);
  assert.equal(cardinalStep({ x: 0, y: 0 }, { x: 0, y: 0 }, 5, free).moved, false);
});

test('eixo bloqueado desliza no outro eixo; dois bloqueios param a criatura', () => {
  // Só o eixo y está livre: ela vai de lado na parede em vez de travar.
  const slide = cardinalStep({ x: 0, y: 0 }, { x: 40, y: 10 }, 5,
    (x, y) => x === 0 && y !== 0);
  assert.deepEqual(slide, { x: 0, y: 5, moved: true, axis: 'y' });
  const stuck = cardinalStep({ x: 0, y: 0 }, { x: 40, y: 10 }, 5, () => false);
  assert.deepEqual(stuck, { x: 0, y: 0, moved: false, axis: null });
});

test('inimigo persegue o herói em L: nunca move x e y no mesmo quadro', () => {
  const engine = make();
  engine.addEnemy('e1', 160, 160);
  // 84,9 px de distância: dentro do aggro (96) e fora do alcance de ataque (32).
  let previous = { x: 160, y: 160 };
  let diagonalSteps = 0;
  for (let frame = 1; frame <= 40; frame++) {
    engine.tick(frame * 100, 100);
    const enemy = engine.enemies.get('e1');
    const movedX = Math.abs(enemy.x - previous.x) > 1e-9;
    const movedY = Math.abs(enemy.y - previous.y) > 1e-9;
    if (movedX && movedY) diagonalSteps++;
    previous = { x: enemy.x, y: enemy.y };
  }
  assert.equal(diagonalSteps, 0, 'a criatura nunca pode andar na diagonal');
  // Em L: o primeiro passo fecha o eixo x (empate resolve no horizontal) e o y
  // só se mexe depois que o x encostou no herói.
  assert.ok(previous.x < 160, 'a criatura deve se aproximar');
  const distance = Math.hypot(previous.x - 100, previous.y - 100);
  assert.ok(distance <= COMBAT_CONFIG.enemy.attackRange + 1e-6 && distance > 0,
    `deveria parar no alcance de ataque, parou em ${distance}`);
});

test('histerese: a criatura termina o eixo escolhido antes de virar (trajeto em L)', () => {
  const engine = make();
  engine.addEnemy('e3', 160, 160);
  engine.tick(100, 100);
  const afterFirst = { ...engine.enemies.get('e3') };
  assert.equal(afterFirst.y, 160, 'o primeiro eixo é o x (empate)');
  // Enquanto o x não encosta no herói, o y não pode se mexer.
  for (let frame = 2; frame <= 12; frame++) {
    engine.tick(frame * 100, 100);
    assert.equal(engine.enemies.get('e3').y, 160);
  }
  for (let frame = 13; frame <= 40; frame++) engine.tick(frame * 100, 100);
  const enemy = engine.enemies.get('e3');
  assert.ok(Math.abs(enemy.x - 100) < 1e-9, `esperava x alinhado, veio ${enemy.x}`);
  assert.ok(enemy.y < 160 && enemy.y > 100);
});

test('mob comum mantém velocidade do catálogo ao andar em eixo', () => {
  const engine = make();
  engine.addEnemy('e2', 100, 180);          // 80 px abaixo: persegue só no y
  engine.tick(100, 100);
  const enemy = engine.enemies.get('e2');
  assert.equal(enemy.x, 100);
  assert.ok(Math.abs((180 - enemy.y) - COMBAT_CONFIG.enemy.speed * 0.1) < 1e-9,
    `passo inesperado: ${180 - enemy.y}`);
});
