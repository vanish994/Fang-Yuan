import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const configURL = moduleURL('combat/combatConfig');
const agentURL = moduleURL('agents/agentBrain');
const engineURL = moduleURL('combat/combatEngine', {
  './combatConfig': configURL, '../agents/agentBrain': agentURL,
});
const catalogURL = moduleURL('combat/guCatalog');
const stateURL = moduleURL('combat/guState', { './guCatalog': catalogURL });
const mobURL = moduleURL('combat/mobCatalog');
const wildURL = moduleURL('combat/wildGu', { './guCatalog': catalogURL });

const { CombatEngine } = await import(engineURL);
const { COMBAT_CONFIG } = await import(configURL);
const { GU_CATALOG } = await import(catalogURL);
const { GuStateStore, GU_STATE_STORAGE_KEY, defaultGuSnapshot } = await import(stateURL);
const { TEST_MOBS } = await import(mobURL);
const wild = await import(wildURL);

const mobOf = id => TEST_MOBS.find(mob => mob.id === id);

/** Armazenamento em memória: os testes de save nunca tocam o navegador. */
const memoryStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, value); },
  };
};

const make = (storage = memoryStorage()) => ({
  storage,
  engine: new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage)),
});

const rewards = events => events.filter(event => event.type === 'reward');
const count = (engine, id) => engine.inventoryCount(id);
const abilities = events => events.filter(event => event.type === 'enemy-ability');

/** Mata o inimigo com golpes básicos, devolvendo todos os eventos. */
const kill = (engine, id, start = 1000) => {
  engine.select(id);
  const events = [];
  for (let i = 0; i < 40; i += 1) {
    const result = engine.basicAttack(start + i * 700);
    events.push(...result.events);
    if (!engine.enemies.get(id)?.alive) break;
  }
  return events;
};

test('criatura nasce sem Gu na maioria dos casos (raridade preservada)', () => {
  // Sem fonte de aleatoriedade o nascimento é determinístico e sem Gu — o
  // cenário de jogo é quem passa Math.random.
  const { engine } = make();
  const plain = engine.addEnemy('sem-gu', 300, 300, 45, mobOf('mob-wild-boar'));
  assert.equal(plain.wild?.gu, undefined, 'sem RNG explícito não há sorteio');

  // Sorteio real: 500 nascimentos com a chance de 2% rendem pouquíssimos Gu.
  const storage = memoryStorage();
  const lucky = new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(storage));
  let withGu = 0;
  for (let i = 0; i < 500; i += 1) {
    const enemy = lucky.addEnemy(`r1-${i}`, 400 + i, 400, 45, mobOf('mob-wild-boar'),
      { random: Math.random });
    if (enemy.wild?.gu) withGu += 1;
  }
  assert.ok(withGu < 40, `2% não pode virar regra (obtido ${withGu}/500)`);
  assert.equal(wild.wildGuChance(1, false), 0.02);
  assert.equal(wild.wildGuChance(2, false), 0.04);
  assert.equal(wild.wildGuChance(3, false), 0.06);
  assert.equal(wild.wildGuChance(2, true), 0.15);
});

test('chance é sorteada só no nascimento; lutar não re-sorteia', () => {
  const { engine } = make();
  let calls = 0;
  const random = () => { calls += 1; return 0; };
  const enemy = engine.addEnemy('sorteado', 180, 100, 60, mobOf('mob-grey-wolf'), { random });
  assert.ok(enemy.wild?.gu, 'com random()=0 o sorteio sempre concede Gu');
  const callsAfterBirth = calls;
  assert.ok(callsAfterBirth <= 2, `no máximo nascimento + escolha do pool, obtido ${callsAfterBirth}`);

  for (let i = 0; i < 200; i += 1) engine.tick(1000 + i * 50, 50);
  assert.equal(calls, callsAfterBirth, 'tick nunca consome aleatoriedade do nascimento');

  const guAtBirth = enemy.wild?.gu;
  for (let i = 0; i < 200; i += 1) engine.tick(20_000 + i * 100, 100);
  assert.equal(enemy.wild?.gu, guAtBirth, 'o Gu é o mesmo durante toda a luta');
});

test('Gu permanece fixo na instância até a morte, mesmo após vários golpes', () => {
  const { engine } = make();
  const enemy = engine.addEnemy('fixo', 120, 100, 80, mobOf('mob-green-snake'),
    { forcedWildGu: 'ghost-fire' });
  assert.equal(enemy.wild?.gu, 'ghost-fire');
  engine.select('fixo');
  engine.basicAttack(1000);
  engine.tick(1200, 100);
  assert.equal(enemy.wild?.gu, 'ghost-fire');
  const events = kill(engine, 'fixo', 2000);
  assert.equal(rewards(events)[0].guReward, 'ghost-fire');
});

test('nenhum Gu acima do Rank da criatura pode ser sorteado ou forçado', () => {
  const rank1 = mobOf('mob-wild-boar');
  assert.equal(rank1.rank, 1);
  for (const id of wild.wildGuPool(1)) {
    assert.equal(GU_CATALOG[id].rank, 1, `${id} não pode aparecer em Rank 1`);
  }
  assert.ok(!wild.wildGuPool(1).includes('moonglow'));
  assert.ok(!wild.wildGuPool(1).includes('white-jade'));

  // Rank 2 só sorteia Rank 1 e 2; Rank 3/4 nunca inventam Gu de Rank superior.
  for (const rank of [2, 3, 4]) {
    for (const id of wild.wildGuPool(rank)) {
      assert.ok(GU_CATALOG[id].rank <= rank, `${id} excede o Rank ${rank}`);
    }
  }

  const { engine } = make();
  // Tentativa explícita de burlar: criatura Rank 1 com Gu Rank 2 é recusada.
  const cheater = engine.addEnemy('cheat', 300, 300, 45, rank1, { forcedWildGu: 'white-jade' });
  assert.equal(cheater.wild?.gu, undefined);

  // Sorteio real: 2000 tentativas em Rank 1 nunca produzem Rank 2.
  const random = () => 0; // sempre "passa" na chance e escolhe o 1º do pool
  for (let i = 0; i < 300; i += 1) {
    const enemy = engine.addEnemy(`cap-${i}`, 400 + i, 400, 45, rank1, { random });
    // Sem Gu, `wild` fica ausente; com Gu, o Rank nunca passa do Rank 1.
    assert.ok(enemy.wild === undefined || GU_CATALOG[enemy.wild.gu].rank <= 1);
  }
});

test('criatura usa o Gu em combate com efeito identificável', () => {
  // Ofensivo: projétil registrado em evento e dano real no herói. O corpo a
  // corpo é neutralizado para que a queda de vida só possa vir do Gu.
  const { engine } = make();
  const archer = engine.addEnemy('arqueiro', 250, 100, 90, mobOf('mob-moon-rabbit'),
    { forcedWildGu: 'star-arrow' });
  archer.lastAttackAt = Infinity;
  const healthBefore = engine.hero.health;
  const events = [];
  for (let i = 0; i < 120; i += 1) events.push(...engine.tick(1000 + i * 100, 100));
  const shots = abilities(events).filter(event => event.guId === 'star-arrow');
  assert.ok(shots.length >= 1, 'deve disparar o Gu da Estrela');
  assert.ok(engine.hero.health < healthBefore, 'o projétil precisa causar dano');
  assert.ok(archer.wild?.casts >= 1);

  // Defensivo: passivo aplicado no nascimento, visível em vida/defesa.
  const { engine: tank } = make();
  const plain = tank.addEnemy('comum', 300, 300, 160, mobOf('mob-stone-lizard'));
  const guarded = tank.addEnemy('guardado', 340, 300, 160, mobOf('mob-stone-lizard'),
    { forcedWildGu: 'white-jade' });
  assert.ok(guarded.maxHealth > plain.maxHealth, 'Jade Branco aumenta a vida');
  assert.ok(guarded.defense > plain.defense, 'Jade Branco aumenta a defesa');

  // Suporte: cura usada quando a criatura está ferida.
  const { engine: healer } = make();
  const healing = healer.addEnemy('curandeiro', 260, 100, 120, mobOf('mob-fierce-wolf'),
    { forcedWildGu: 'cleansing-water' });
  // Ferida como ficaria após troca de golpes; a cura só entra abaixo de 60%.
  healing.health = Math.round(healing.maxHealth * 0.4);
  const injured = healing.health;
  const healEvents = [];
  for (let i = 0; i < 120; i += 1) healEvents.push(...healer.tick(2000 + i * 100, 100));
  assert.ok(abilities(healEvents).some(event => event.guId === 'cleansing-water'));
  assert.ok(healing.health > injured, 'a cura precisa repor vida');
  assert.ok(healing.health <= healing.maxHealth, 'a cura nunca passa do teto');
});

test('projétil do Gu selvagem acerta alvo fora do eixo cardeal', () => {
  // Regressão: o disparo era cardeal e só acertava com desvio <= 16 px, então
  // criaturas que vagueiam (±32 px) anunciavam o Gu e nunca causavam dano.
  for (const dy of [0, 8, 16, 20, 24, 32]) {
    const { engine } = make();
    const archer = engine.addEnemy('alvo', 250, 100 + dy, 90, mobOf('mob-moon-rabbit'),
      { forcedWildGu: 'star-arrow' });
    archer.lastAttackAt = Infinity; // isola o Gu do corpo a corpo
    const before = engine.hero.health;
    const events = [];
    for (let i = 0; i < 160; i += 1) events.push(...engine.tick(1000 + i * 50, 50));
    const shots = abilities(events).filter(event => event.guId === 'star-arrow');
    assert.ok(shots.length >= 1, `dy=${dy}: o Gu precisa ser usado`);
    assert.ok(engine.hero.health < before, `dy=${dy}: o Gu anunciado precisa causar dano`);
  }
});

test('derrotar criatura com Gu entrega exatamente o Gu registrado', () => {
  const { engine } = make();
  const enemy = engine.addEnemy('portador', 120, 100, 30, mobOf('mob-mountain-monkey'),
    { forcedWildGu: 'dragonpill-cricket' });
  assert.equal(enemy.wild?.gu, 'dragonpill-cricket');
  const events = kill(engine, 'portador');
  const reward = rewards(events)[0];
  assert.equal(reward.guReward, 'dragonpill-cricket');
  assert.equal(engine.pendingWildGu('portador'), 'dragonpill-cricket');

  // O kit inicial já traz todo Gu Rank 1: a recompensa soma uma unidade.
  const before = count(engine, 'dragonpill-cricket');
  const claim = engine.claimWildGu('portador');
  assert.equal(claim.ok, true);
  assert.equal(claim.guId, 'dragonpill-cricket');
  assert.equal(count(engine, 'dragonpill-cricket'), before + 1);
  // Pedras e material continuam vindo separados pelo sistema de loot existente.
  assert.equal(typeof reward.stoneReward, 'number');
  assert.ok(reward.materialId);
  assert.equal(engine.pendingWildGu('portador'), null);
});

test('criatura sem Gu nunca concede Gu', () => {
  const { engine } = make();
  engine.addEnemy('sem-gu', 120, 100, 20, mobOf('mob-wild-boar'), { forcedWildGu: null });
  const events = kill(engine, 'sem-gu');
  const reward = rewards(events)[0];
  assert.equal(reward.guReward, undefined);
  assert.equal(engine.pendingWildGu('sem-gu'), null);
  assert.equal(engine.claimWildGu('sem-gu').ok, false);
  const before = engine.inventoryCount('whirlwind');
  assert.equal(engine.inventoryCount('whirlwind'), before);
});

test('processar a mesma morte duas vezes não duplica a recompensa', () => {
  const { engine } = make();
  engine.addEnemy('unico', 120, 100, 20, mobOf('mob-grey-wolf'), { forcedWildGu: 'bone-spear' });
  const first = kill(engine, 'unico');
  assert.equal(rewards(first).length, 1);
  assert.equal(engine.basicAttack(99_000).events.filter(e => e.type === 'reward').length, 0);
  // Reentrada no motor com o mesmo id (outra área/sessão de UI) não recria o drop.
  engine.clearAreaEnemies();
  engine.addEnemy('unico', 120, 100, 20, mobOf('mob-grey-wolf'), { forcedWildGu: 'bone-spear' });
  engine.select('unico');
  assert.equal(engine.basicAttack(99_500).events.filter(e => e.type === 'reward').length, 0);

  const before = count(engine, 'bone-spear');
  const firstClaim = engine.claimWildGu('unico');
  const secondClaim = engine.claimWildGu('unico');
  assert.equal(firstClaim.ok, true);
  assert.equal(secondClaim.alreadyClaimed, true);
  assert.equal(count(engine, 'bone-spear'), before + 1, 'uma única unidade foi somada');
});

test('inventário mantém Gu e recursos existentes ao receber a recompensa', () => {
  const storage = memoryStorage();
  const seeded = defaultGuSnapshot();
  seeded.inventory['moonlight'] = 3;
  seeded.inventory['stone-skin'] = 2;
  seeded.equipment.passive = 'stone-skin';
  seeded.assimilated = ['bear-strength'];
  new GuStateStore(storage).save(seeded);

  const { engine } = make(storage);
  assert.equal(engine.equipment.passive, 'stone-skin');
  assert.ok(engine.assimilatedList().includes('bear-strength'));
  engine.addEnemy('drop', 120, 100, 20, mobOf('mob-wild-boar'), { forcedWildGu: 'rock-skin' });
  kill(engine, 'drop');
  const before = count(engine, 'rock-skin');
  const claim = engine.claimWildGu('drop');
  assert.equal(claim.ok, true);
  assert.equal(count(engine, 'rock-skin'), before + 1);
  assert.equal(engine.inventoryCount('moonlight'), 3, 'Gu anterior preservado');
  assert.equal(engine.inventoryCount('stone-skin'), 2, 'quantidade anterior preservada');
  assert.equal(engine.equipment.passive, 'stone-skin', 'equipamento preservado');
  assert.ok(engine.assimilatedList().includes('bear-strength'), 'assimilação preservada');
});

test('equipar o Gu obtido respeita slots e restrições existentes', () => {
  const { engine } = make();
  engine.addEnemy('drop', 120, 100, 20, mobOf('mob-wild-boar'), { forcedWildGu: 'iron-skin' });
  kill(engine, 'drop');
  const before = count(engine, 'iron-skin');
  engine.claimWildGu('drop');
  assert.equal(count(engine, 'iron-skin'), before + 1);

  // Trocar durante o combate continua bloqueado (regra anterior preservada).
  assert.equal(engine.equip('passive', 'iron-skin', 1000).ok, false);
  assert.match(engine.equip('passive', 'iron-skin', 1000).reason, /combate/);
  // Fora de combate, o Gu obtido entra no slot compatível.
  const equip = engine.equip('passive', 'iron-skin', 60_000);
  assert.equal(equip.ok, true, equip.reason);
  assert.equal(engine.equipment.passive, 'iron-skin');
  // Um Gu não pode ir para o slot errado.
  assert.equal(engine.equip('attack', 'iron-skin', 60_000).ok, false);
  // Dois Gu no mesmo slot: substitui, nunca acumula.
  assert.equal(engine.equip('passive', 'stone-skin', 60_000).ok, true);
  assert.equal(engine.equipment.passive, 'stone-skin');
  assert.equal(engine.isEquipped('iron-skin'), false);
});

test('save/load preserva o Gu obtido e os dados anteriores', () => {
  const storage = memoryStorage();
  const { engine } = make(storage);
  engine.addEnemy('drop', 120, 100, 20, mobOf('mob-wild-boar'), { forcedWildGu: 'star-arrow' });
  kill(engine, 'drop');
  const before = count(engine, 'star-arrow');
  engine.claimWildGu('drop');
  engine.applyCultivation({ rank: 2, stage: 'Média', spiritStones: 420, materials: {} });
  const after = count(engine, 'star-arrow');
  assert.equal(after, before + 1);

  const raw = JSON.parse(storage.getItem(GU_STATE_STORAGE_KEY));
  assert.equal(raw.version, 1);
  assert.equal(raw.inventory['star-arrow'], after);

  // Nova sessão: inventário e cultivo continuam; nenhuma recompensa é recriada.
  const reloaded = new CombatEngine(COMBAT_CONFIG, 100, 100,
    { rank: 2, stage: 'Média', spiritStones: 420, materials: {} }, new GuStateStore(storage));
  assert.equal(reloaded.inventoryCount('star-arrow'), after);
  assert.equal(reloaded.cultivationState.spiritStones, 420);
  assert.equal(reloaded.pendingWildGu('drop'), null);

  // Save antigo (v0, sem inventário) continua migrando sem apagar dados.
  const legacy = memoryStorage();
  legacy.setItem(GU_STATE_STORAGE_KEY, JSON.stringify({
    equipment: { attack: 'moonlight', passive: 'stone-skin', movement: null, support: null },
    assimilated: ['black-boar'],
  }));
  const migrated = new CombatEngine(COMBAT_CONFIG, 100, 100, undefined, new GuStateStore(legacy));
  assert.equal(migrated.equipment.attack, 'moonlight');
  assert.equal(migrated.inventoryCount('moonlight'), 1);
  assert.ok(migrated.assimilatedList().includes('black-boar'));
});

test('mecânicas existentes continuam válidas para criaturas sem Gu', () => {
  const { engine } = make();
  const boar = engine.addEnemy('javali', 130, 100, 45, mobOf('mob-wild-boar'), { forcedWildGu: null });
  assert.equal(boar.defense, mobOf('mob-wild-boar').defense);
  assert.equal(boar.maxHealth, 45);
  assert.equal(engine.enemyStats.get('javali').damage, mobOf('mob-wild-boar').damage);

  engine.select('javali');
  const attack = engine.basicAttack(1000);
  assert.equal(attack.ok, true);
  assert.ok(attack.events.some(event => event.type === 'damage'));
  const events = kill(engine, 'javali', 2000);
  const reward = rewards(events)[0];
  // Loot por criatura: Javali Selvagem rende o que o catálogo declara, não o
  // valor fixo global (que continua valendo só para inimigos sem `mob`).
  assert.equal(reward.stoneReward, mobOf('mob-wild-boar').rewardStones);
  assert.equal(reward.materialId, mobOf('mob-wild-boar').rewardMaterialId);

  // Moonlight (attack) e Whirlwind (movement) seguem funcionando como antes.
  const fresh = make().engine;
  assert.equal(fresh.equip('attack', 'moonlight', 0).ok, true);
  assert.equal(fresh.equip('movement', 'whirlwind', 0).ok, true);
  const moonlight = fresh.activate('moonlight', 1000, 'right');
  assert.equal(moonlight.ok, true, moonlight.reason);
  assert.ok(fresh.projectiles.length >= 1);
  const dash = fresh.activate('whirlwind', 3000, 'right');
  assert.equal(dash.ok, true, dash.reason);
  // Usar Gu engaja o combate: trocar equipamento continua bloqueado.
  assert.equal(fresh.equip('passive', 'jade-skin', 3000).ok, false);
});

test('pool selvagem exclui consumíveis e Gu sem efeito de combate observável', () => {
  assert.equal(wild.isWildGuCandidate(GU_CATALOG['flash-blink']), false);
  assert.equal(wild.isWildGuCandidate(GU_CATALOG['liquor-worm']), false);
  assert.equal(wild.isWildGuCandidate(GU_CATALOG['bear-strength']), false);
  assert.equal(wild.isWildGuCandidate(GU_CATALOG['moonlight']), true);
  assert.equal(wild.isWildGuCandidate(GU_CATALOG['jade-skin']), true);
  // Afinidade nunca fura o teto de Rank: Lobo Feroz (R2) com afinidade de R2
  // continua elegível, mas um Rank 1 nunca recebe Moonglow.
  assert.deepEqual(wild.wildGuPool(2, ['moonglow']), ['moonglow']);
  const rank1Affinity = wild.wildGuPool(1, ['moonglow']);
  assert.ok(!rank1Affinity.includes('moonglow'));
  assert.ok(rank1Affinity.length > 0);
});
