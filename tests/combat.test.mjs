import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleURL(path, imports = {}) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, url] of Object.entries(imports)) js = js.replace(`from '${from}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG, TEST_ENEMY_OFFSETS } = await import(configURL);
const profileURL = moduleURL('entities/characterProfile');
const balanceURL = moduleURL('entities/cultivationBalance');
const cultivationURL = moduleURL('entities/cultivation');
const sessionURL = moduleURL('entities/characterCultivation', {
  './characterProfile': profileURL, './cultivationBalance': balanceURL,
  './cultivation': cultivationURL,
});
const { CharacterCultivation } = await import(sessionURL);
const { cardinalFromTouch } = await import(moduleURL('ui/cardinalStick'));
const { primordialSeaFrame, primordialSeaOffset } = await import(moduleURL('ui/primordialSea'));

const make = (overrides = {}) => new CombatEngine({ ...COMBAT_CONFIG, ...overrides }, 100, 100);
const empty = e => e.events.filter(event => event.type === 'reward');

test('início do mapa deixa inventário liberado; aproximar-se ativa combate', () => {
  const engine = make();
  TEST_ENEMY_OFFSETS.forEach(([dx, dy], i) => engine.addEnemy(`teste-${i}`, 100 + dx, 100 + dy));
  engine.tick(100, 100);
  assert.equal(engine.inCombat(100), false);
  assert.equal(engine.equip('passive', 'stone-skin', 100).ok, true);
  engine.hero.x += 30;
  engine.tick(200, 100);
  assert.equal(engine.inCombat(200), true);
  assert.match(engine.equip('passive', null, 200).reason, /combate/);
});

test('troca de área limpa encontros sem perder vida, essência, Gu ou duplicar recompensas', () => {
  const engine = make();
  engine.hero.health = 72;
  engine.essence = 54;
  assert.equal(engine.equip('passive', 'stone-skin', 0).ok, true);
  engine.addEnemy('area:teste', 120, 100, 10);
  engine.select('area:teste');
  assert.equal(engine.basicAttack(1000).events.filter(e => e.type === 'reward').length, 1);
  engine.clearAreaEnemies();
  assert.equal(engine.enemies.size, 0);
  assert.equal(engine.target, null);
  assert.equal(engine.hero.health, 72);
  assert.equal(engine.essence, 54);
  assert.equal(engine.equipment.passive, 'stone-skin');
  engine.addEnemy('area:teste', 120, 100, 10);
  assert.equal(engine.basicAttack(2000).ok, false, 'não há alvo selecionado');
  engine.select('area:teste');
  assert.equal(engine.basicAttack(2000).events.filter(e => e.type === 'reward').length, 0);
});

test('alvo manual tem prioridade; automático é opcional e só atinge dentro do alcance', () => {
  const engine = make();
  engine.addEnemy('perto', 125, 100);
  engine.addEnemy('longe', 149, 100);
  assert.equal(engine.basicAttack(0).ok, false);
  engine.autoTarget = true;
  assert.equal(engine.target.id, 'perto');
  engine.select('longe');
  assert.equal(engine.target.id, 'longe');
  assert.equal(engine.basicAttack(0).ok, true);
  assert.equal(engine.enemies.get('perto').health, 36);
  assert.equal(engine.enemies.get('longe').health, 25);
  assert.equal(engine.basicAttack(100).ok, false);
  assert.equal(engine.basicAttack(600).ok, true);
  engine.addEnemy('fora', 300, 100);
  engine.select('fora');
  assert.match(engine.basicAttack(1200).reason, /fora do alcance/);
  engine.select('perto');
  assert.match(engine.basicAttack(1200, (x) => x < 108).reason, /Obstáculo/);
});

test('dano aplica defesa e mínimo um; morte emite uma recompensa e nunca duplica', () => {
  const engine = make();
  engine.addEnemy('e1', 120, 100, 10);
  engine.select('e1');
  const result = engine.basicAttack(1000);
  assert.deepEqual(result.events.map(e => e.type), ['damage', 'defeat', 'reward']);
  assert.equal(empty(result)[0].stoneReward, COMBAT_CONFIG.enemy.lootStones);
  assert.equal(empty(result)[0].materialId, 'ruptura-rank-1');
  assert.equal(engine.basicAttack(2000).ok, false);
  assert.equal(engine.enemies.get('e1').rewarded, true);
  const sturdy = make({ enemy: { ...COMBAT_CONFIG.enemy, defense: 999 } });
  sturdy.addEnemy('armadura', 110, 100);
  sturdy.select('armadura');
  assert.equal(sturdy.basicAttack(1).events[0].amount, 1);
});

test('Moonlight tem projétil independente de animação: atravessa morto, para no vivo', () => {
  const engine = make({ enemy: { ...COMBAT_CONFIG.enemy, speed: 0, aggroRange: 0 } });
  engine.addEnemy('morto', 130, 100, 10);
  engine.addEnemy('vivo', 155, 100, 40);
  engine.addEnemy('intocado', 180, 100, 40);
  const started = engine.castMoonlight(0, 'right');
  assert.equal(started.ok, true);
  assert.equal(engine.essence, 84);
  assert.equal(engine.castMoonlight(1, 'right').ok, false);
  const events = [];
  for (let i = 1; i <= 8; i++) events.push(...engine.tick(i * 100, 100));
  assert.deepEqual(events.filter(e => e.type === 'damage').map(e => e.targetId), ['morto', 'vivo']);
  assert.equal(engine.enemies.get('morto').alive, false);
  assert.equal(engine.enemies.get('vivo').health, 19);
  assert.equal(engine.enemies.get('intocado').health, 40);
  assert.equal(events.filter(e => e.type === 'reward').length, 1);
  assert.equal(engine.activeProjectiles.length, 0);
  assert.equal(engine.cooldownRemaining('moonlight', 1000), 800);
  assert.equal(engine.castMoonlight(1800, 'right').ok, true);
});

test('hitbox cruza frames longos e obstáculo bloqueia projétil sem gastar duas vezes', () => {
  const engine = make({ enemy: { ...COMBAT_CONFIG.enemy, speed: 0, aggroRange: 0 } });
  engine.addEnemy('além', 170, 100);
  engine.castMoonlight(0, 'right');
  const events = engine.tick(100, 100, (x) => x < 125);
  assert.equal(engine.activeProjectiles.length, 0);
  assert.equal(events.filter(e => e.type === 'damage').length, 0);
  assert.equal(engine.enemies.get('além').health, 36);
  assert.equal(engine.essence, 84.1);
});

test('slots funcionais: trocas só fora de combate; passivos aplicam e são removidos', () => {
  const engine = make();
  assert.equal(engine.equip('passive', 'cicada', 0).ok, false);
  assert.equal(engine.equip('attack', 'stone-skin', 0).ok, false);
  assert.equal(engine.equip('passive', 'stone-skin', 0).ok, true);
  assert.equal(engine.defense, 6);
  assert.equal(engine.equip('support', 'liquor-worm', 0).ok, true);
  engine.essence = 0;
  engine.tick(1, 100);
  assert.ok(Math.abs(engine.essence - .3) < 1e-9);
  engine.addEnemy('e1', 120, 100);
  engine.select('e1');
  engine.basicAttack(1000);
  assert.equal(engine.equip('passive', null, 1001).ok, false);
  assert.equal(engine.defense, 6);
  assert.equal(engine.equip('passive', null, 6001).ok, true);
  assert.equal(engine.defense, 2);
  assert.equal(engine.equip('support', null, 6001).ok, true);
  assert.equal(engine.essenceRegen, 1);
});

test('inimigos atacam no mapa com recarga; Stone Skin reduz dano sem imunidade', () => {
  const engine = make();
  engine.addEnemy('próximo', 120, 100);
  engine.equip('passive', 'stone-skin', 0);
  assert.deepEqual(engine.tick(100, 100).filter(e => e.type === 'damage').map(e => e.amount), [2]);
  assert.equal(engine.hero.health, 98);
  assert.equal(engine.tick(500, 100).filter(e => e.type === 'damage').length, 0);
  assert.equal(engine.tick(1550, 100).filter(e => e.type === 'damage').length, 1);
  assert.equal(engine.hero.health, 96);
});

test('dash só com Gu de movimento; respeita obstáculo/custo/recarga e bônus sem empilhar', () => {
  const engine = make();
  assert.equal(engine.dash(0, 'right', () => true).ok, false);
  engine.equip('movement', 'whirlwind', 0);
  const blocked = engine.dash(0, 'right', () => false);
  assert.equal(blocked.ok, false);
  assert.equal(engine.essence, 100);
  const dash = engine.dash(0, 'right', x => x < 150);
  assert.equal(dash.ok, true);
  assert.equal(engine.hero.x, 148);
  assert.equal(engine.essence, 80);
  assert.equal(engine.speedMultiplier(100), 1.5);
  assert.equal(engine.dash(100, 'right', () => true).ok, false);
  assert.equal(engine.speedBonusUntil, 1800);
  assert.equal(engine.speedMultiplier(1800), 1);
  assert.equal(engine.dash(5000, 'up', () => true).ok, true);
  assert.equal(engine.speedBonusUntil, 6800);
  engine.hero.health = 1;
  engine.hitHero(999, 5100, 'golpe-final', () => 1);
  assert.equal(engine.hero.alive, false);
  assert.equal(engine.respawn(100, 100), true);
  assert.equal(engine.speedMultiplier(5101), 1); // bônus temporário não sobrevive à morte
});

test('Cigarra: 5% com 50% vida, recarga apenas no sucesso e golpes duplicados ignorados', () => {
  const engine = make();
  assert.equal(engine.config.cicada.chance, .05);
  engine.hero.health = 5;
  assert.deepEqual(engine.hitHero(999, 0, 'primeiro', () => .049).map(e => e.type),
    ['damage', 'resurrect']);
  assert.equal(engine.hero.health, 50);
  assert.equal(engine.cooldownRemaining('cicada', 0), 600000);
  assert.deepEqual(engine.hitHero(999, 0, 'primeiro', () => 0), []);
  assert.equal(engine.hero.health, 50);
  assert.deepEqual(engine.hitHero(999, 1, 'segundo', () => 0).map(e => e.type),
    ['damage', 'hero-death']);
  assert.equal(engine.hero.alive, false);
  assert.deepEqual(engine.hitHero(999, 2, 'terceiro', () => 0), []);
  assert.equal(engine.respawn(100, 100), true);
  assert.equal(engine.cooldownRemaining('cicada', 1000), 599000);
  assert.deepEqual(engine.hitHero(999, 600000, 'quarto', () => .05).map(e => e.type),
    ['damage', 'hero-death']);
  assert.equal(engine.cooldownRemaining('cicada', 600000), 0);
  engine.respawn(100, 100);
  assert.deepEqual(engine.hitHero(999, 600001, 'quinto', () => 0).map(e => e.type),
    ['damage', 'resurrect']);
});

test('loot de inimigos é uma transação única salva; falha de storage não publica metade', () => {
  const data = new Map();
  let fail = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => {
    if (fail) throw new Error('sem espaço');
    data.set(key, value);
  } };
  const session = new CharacterCultivation(storage);
  const engine = make();
  engine.addEnemy('drop', 120, 100, 10); engine.select('drop');
  const reward = empty(engine.basicAttack(0))[0];
  fail = true;
  assert.throws(() => session.receiveLoot(reward.stoneReward, reward.materialId, reward.materialQuantity));
  assert.equal(session.state.spiritStones, 0);
  assert.deepEqual(session.state.materials, {});
  fail = false;
  session.receiveLoot(reward.stoneReward, reward.materialId, reward.materialQuantity);
  assert.equal(session.state.spiritStones, 8);
  assert.equal(session.state.materials['ruptura-rank-1'], 1);
  assert.deepEqual(new CharacterCultivation(storage).state, session.state);
  assert.equal(empty(engine.basicAttack(1000)).length, 0);
});

test('controles de toque são circulares, translúcidos e preservam áreas de toque', () => {
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(css, /\.combat-joystick\s*\{[^}]*border-image:\s*none;[^}]*border-radius:\s*50%;[^}]*background:\s*#[0-9a-f]{8};/s);
  assert.match(css, /\.combat-actions button\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px;[^}]*border-image:\s*none;[^}]*border-radius:\s*50%;[^}]*background:\s*#[0-9a-f]{8};/s);
});

test('HUD captura toques informativos e drops pendentes respeitam o intervalo de retry', () => {
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(css, /\.combat-top\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(scene, /this\.pendingRewards\.length && this\.time\.now >= this\.nextRewardRetryAt\) this\.flushRewards\(\)/);
  assert.equal((scene.match(/this\.flushRewards\(\)/g) ?? []).length, 1);
});

test('toque mobile respeita zona morta e decide direção cardinal sem diagonais', () => {
  assert.equal(cardinalFromTouch(0, 0), null);
  assert.equal(cardinalFromTouch(8, 0), null);
  assert.equal(cardinalFromTouch(50, 10), 'right');
  assert.equal(cardinalFromTouch(-50, 10), 'left');
  assert.equal(cardinalFromTouch(10, -50), 'up');
  assert.equal(cardinalFromTouch(10, 50), 'down');
  assert.equal(cardinalFromTouch(NaN, 50), null);
});

test('Mar Primordial reflete gasto e regeneração da mesma reserva de combate', () => {
  const engine = make({ enemy: { ...COMBAT_CONFIG.enemy, aggroRange: 0 } });
  assert.equal(primordialSeaFrame(engine.essence, engine.config.hero.maxEssence), 10);
  assert.equal(engine.castMoonlight(0, 'right').ok, true);
  assert.equal(primordialSeaFrame(engine.essence, engine.config.hero.maxEssence), 8);
  assert.equal(primordialSeaOffset(engine.essence, 100, 80), -640);
  engine.essence = 49;
  engine.tick(100, 100);
  assert.equal(primordialSeaFrame(engine.essence, 100), 5);
  engine.essence = 0;
  assert.equal(primordialSeaFrame(engine.essence, 100), 0);
  assert.equal(primordialSeaFrame(-20, 100), 0);
  assert.equal(primordialSeaFrame(150, 100), 10);
  assert.equal(primordialSeaFrame(NaN, 100), 0);
  assert.equal(primordialSeaFrame(50, 0), 0);
});

test('HUD mobile tem barras, alvo e controle; equipagem fica somente no inventário', () => {
  const html = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /combat-joystick/);
  assert.match(html, /combat-health/);
  assert.match(html, /combat-essence/);
  assert.match(html, /combat-health-value/);
  assert.match(html, /combat-essence-value/);
  assert.match(html, /id="combat-target-name" hidden/);
  assert.doesNotMatch(html, /combat-topline|combat-stats/);
  assert.doesNotMatch(html, /combat-sea|sea-sprite|mar-primordial-11x128/);
  assert.match(html, /essência primordial/i);
  assert.doesNotMatch(html, /combat-slots|combat-gear|GU_SLOTS|GU_CATALOG/);
  assert.match(html, /combat-cicada/);
  assert.match(html, /data-action="auto"/);
  assert.match(css, /safe-area-inset-bottom/);
});
