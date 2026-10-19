import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleURL(path, imports = {}) {
  let js = ts.transpileModule(readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, url] of Object.entries(imports)) js = js.replace(`from '${from}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const agentURL = moduleURL('agents/agentBrain');
const { AgentBrain, perceive } = await import(agentURL);
const { TEST_MOBS } = await import(moduleURL('combat/mobCatalog'));
const configURL = moduleURL('combat/combatConfig');
const { CombatEngine } = await import(moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
}));
const { isWalkableTile } = await import(moduleURL('world/qingMaoGround'));

const traits = { kind: 'enemy', vision: 100, attackRange: 32, memoryMs: 30000,
  fear: 0.35, pack: true };
const input = (self, player, healthRatio = 1, rest = {}) =>
  ({ self, home: self, player, healthRatio, ...rest });

test('Perception → Memory → Goal → Decision → Action para inimigos e NPCs', () => {
  const brain = new AgentBrain(traits);
  assert.equal(perceive(input({ x: 0, y: 0 }, { x: 101, y: 0 }), traits), null);
  assert.equal(brain.decide(0, input({ x: 0, y: 0 }, { x: 80, y: 0 })).action, 'chase');
  assert.deepEqual(brain.memory.lastSeen, { x: 80, y: 0 });
  assert.equal(brain.decide(100, input({ x: 60, y: 0 }, { x: 80, y: 0 })).action, 'attack');
  assert.equal(brain.decide(200, input({ x: 60, y: 0 }, null)).action, 'investigate');
  assert.equal(brain.decide(30101, input({ x: 60, y: 0 }, null), () => 0.99).action, 'wander');
  assert.equal(brain.decide(30200, input({ x: 60, y: 0 }, { x: 80, y: 0 }, 0.2)).action, 'flee');
  const npc = new AgentBrain({ ...traits, kind: 'npc', pack: false });
  assert.equal(npc.decide(0, { ...input({ x: 0, y: 0 }, null), danger: { x: 50, y: 0 } }).action, 'alert');
  npc.interact(123);
  assert.equal(npc.memory.lastInteractionAt, 123);
});

test('catálogo provisório contém 12 mobs e 4 bosses e nenhum surge dentro da mata', () => {
  assert.equal(TEST_MOBS.filter(m => m.tier !== 'boss').length, 12);
  assert.equal(TEST_MOBS.filter(m => m.tier === 'boss').length, 4);
  assert.equal(new Set(TEST_MOBS.map(m => m.id)).size, TEST_MOBS.length);
  for (const mob of TEST_MOBS) {
    assert.equal(isWalkableTile(Math.floor(mob.x / 32), Math.floor(mob.y / 32)), true, mob.name);
    assert.ok(mob.health > 0 && mob.speed > 0 && mob.aggroRange > 0);
  }
});

test('motor aplica HP, defesa, dano e detecção por criatura; habilidades planejadas não executam', () => {
  const boar = TEST_MOBS[0];
  const engine = new CombatEngine(undefined, 100, 100);
  const enemy = engine.addEnemy(boar.id, 120, 100, boar.health, boar);
  assert.equal(enemy.name, 'Javali Selvagem');
  assert.equal(enemy.maxHealth, 45);
  assert.equal(enemy.defense, 2);
  engine.tick(100, 100);
  assert.equal(engine.hero.health, 93); // 9 dano - 2 defesa padrão
  engine.select(boar.id);
  assert.equal(engine.basicAttack(1000).events[0].amount, 10); // 12 dano - 2 defesa
  const boss = TEST_MOBS.find(m => m.tier === 'boss');
  const bossEnemy = engine.addEnemy(boss.id, 1000, 1000, boss.health, boss);
  assert.equal(bossEnemy.maxHealth, 1200);
  assert.equal(bossEnemy.defense, 45);
  assert.equal(engine.agentMemory(boar.id).lastSeen.x, 100);
});

test('lobos avisam o grupo, lembram onde viram o jogador e fogem quando feridos', () => {
  const wolf = TEST_MOBS.find(m => m.id === 'mob-grey-wolf');
  const engine = new CombatEngine(undefined, 100, 100);
  const near = engine.addEnemy('near', 140, 100, wolf.health, wolf);
  engine.addEnemy('far', 270, 100, wolf.health, wolf);
  engine.tick(100, 100);
  assert.deepEqual(engine.agentMemory('far').lastSeen, { x: 100, y: 100 });
  near.health = 10;
  const before = near.x;
  engine.tick(200, 100);
  assert.ok(near.x > before, 'lobo ferido deve se afastar');
});
