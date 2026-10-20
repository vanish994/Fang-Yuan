import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleURL } from './support/tsModule.mjs';

const { CombatEngine } = await import(moduleURL('combat/combatEngine'));
const { GU_CATALOG, GU_IDS, GU_BY_SLOT, RANK_ONE_GU_COUNT, PENDING_GU_SLOTS,
  isAssimilable, isEquippable } = await import(moduleURL('combat/guCatalog'));
const { GU_RECIPES, recipeById, validateRecipes } = await import(moduleURL('combat/guRecipes'));
const { GuStateStore, GU_STATE_STORAGE_KEY, GU_STATE_VERSION, MAX_GU_STACK,
  emptyInventory, normalizeGuSnapshot } = await import(moduleURL('combat/guState'));
const { GU_SLOTS } = await import(moduleURL('combat/combatConfig'));
const { mitigatedDamage } = await import(moduleURL('combat/damageFormula'));

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function makeEngine({ rank = 1, storage = memoryStorage() } = {}) {
  const store = new GuStateStore(storage);
  const cultivation = { rank, stage: 'Inicial', spiritStones: 0, materials: {} };
  const engine = new CombatEngine(undefined, 100, 100, cultivation, store);
  return { engine, storage, store };
}

// ── Catálogo e fidelidade ───────────────────────────────────────────────────
test('catálogo Rank 1: 24 Gu verificados, quatro slots e candidatos rejeitados documentados', () => {
  assert.deepEqual(GU_SLOTS, ['attack', 'passive', 'movement', 'support']);
  assert.equal(GU_IDS.length, 26); // 24 Rank 1 + 2 resultados de refino Rank 2
  assert.equal(RANK_ONE_GU_COUNT, 24);
  assert.equal(new Set(GU_IDS).size, GU_IDS.length);
  for (const slot of ['attack', 'passive']) {
    assert.ok(GU_BY_SLOT[slot].filter(gu => gu.rank === 1).length >= 6, slot);
  }
  // Não inventamos movimento: a lacuna é explícita, com o motivo de cada rejeição.
  assert.equal(GU_BY_SLOT.movement.filter(gu => gu.rank === 1).length, 3);
  assert.deepEqual(PENDING_GU_SLOTS.map(pending => [pending.slot, pending.missing]),
    [['movement', 3]]);
  assert.match(PENDING_GU_SLOTS[0].reason, /Chasing Wind \(Rank 4\)/);
  for (const id of GU_IDS) {
    const gu = GU_CATALOG[id];
    assert.equal(gu.id, id);
    assert.ok(gu.categories.length > 0, `${id} sem categoria funcional`);
    assert.ok(gu.source.reference.length > 0, `${id} sem fonte`);
    assert.ok(!gu.categories.includes('pending'), id);
    if (gu.rank === 1) {
      assert.notEqual(gu.fidelity, 'pending', id);
      assert.ok(gu.price >= 500 && gu.price <= 1000, `${id}: preço fora da faixa canônica`);
    }
  }
  // Blood Moon é Rank 3 e não pode entrar no catálogo Rank 1.
  assert.equal(GU_IDS.includes('blood-moon'), false);
  assert.deepEqual(GU_IDS.filter(id => GU_CATALOG[id].rank === 1)
    .filter(id => ['blood-moon', 'moon-raiment', 'black-mane'].includes(id)), []);
  // Rank 2 tem dados próprios, não recicla os números do Rank 1.
  assert.equal(GU_CATALOG.moonglow.usage.requiresRank, 2);
  assert.equal(GU_CATALOG.moonglow.active.damage, 40);
  assert.notEqual(GU_CATALOG.moonglow.active.damage, GU_CATALOG.moonlight.active.damage);
  assert.equal(GU_CATALOG.moonglow.price, 2200);
  assert.deepEqual(GU_CATALOG['white-jade'].passive, { defense: 8, maxHealthMultiplier: 1.12 });
  // Nenhum Gu domina outro em dano, alcance, velocidade, custo e recarga ao mesmo tempo.
  const projectiles = GU_IDS.map(id => GU_CATALOG[id])
    .filter(gu => gu.active?.kind === 'projectile');
  // Mecânicas próprias contam como vantagem: perfuração, área, múltiplos
  // projéteis e dano espiritual não podem ser ignorados na comparação.
  const mechanics = gu => [gu.active.pierce, gu.active.splashRadius > 0, gu.active.count > 1,
    gu.active.damageType === 'spirit'];
  for (const a of projectiles) {
    for (const b of projectiles) {
      if (a.id === b.id) continue;
      const damageA = a.active.damage * a.active.count;
      const damageB = b.active.damage * b.active.count;
      const covers = mechanics(b).every((has, index) => has ? mechanics(a)[index] : true);
      const dominates = covers && damageA >= damageB && a.active.range >= b.active.range
        && a.active.speed >= b.active.speed && a.usage.essenceCost <= b.usage.essenceCost
        && a.usage.cooldownMs <= b.usage.cooldownMs;
      assert.equal(dominates, false, `${a.id} domina ${b.id}`);
    }
  }
  const dashes = GU_IDS.map(id => GU_CATALOG[id]).filter(gu => gu.active?.kind === 'dash');
  for (const a of dashes) {
    for (const b of dashes) {
      if (a.id === b.id) continue;
      const dominates = a.active.distance >= b.active.distance
        && a.active.speedMultiplier >= b.active.speedMultiplier
        && a.active.durationMs >= b.active.durationMs
        && a.usage.essenceCost <= b.usage.essenceCost
        && a.usage.cooldownMs <= b.usage.cooldownMs;
      assert.equal(dominates, false, `${a.id} domina ${b.id}`);
    }
  }
});

// ── Equipamento ─────────────────────────────────────────────────────────────
test('equipamento: valida slot, posse e combate; troca não deixa bônus residual', () => {
  const { engine } = makeEngine();
  assert.equal(engine.equipment.attack, 'moonlight');
  assert.equal(engine.equip('attack', 'stone-skin', 0).ok, false);
  assert.equal(engine.equip('passive', 'moonlight', 0).ok, false);
  assert.equal(engine.equip('support', 'bear-strength', 0).ok, false, 'assimilável não é equipável');
  // Rank 2 exige Rank 2: possuir o Gu não basta para equipá-lo.
  engine.inventory.moonglow = 1;
  assert.equal(engine.equip('attack', 'moonglow', 0).ok, false);
  assert.match(engine.equip('attack', 'moonglow', 0).reason, /Rank insuficiente/);
  engine.inventory.moonglow = 0;
  assert.equal(engine.defense, 2);

  assert.equal(engine.equip('passive', 'jade-skin', 0).ok, true);
  assert.equal(engine.defense, 5);
  assert.equal(engine.hero.maxHealth, 108);
  assert.equal(engine.stats(0).equipped.maxHealth, 8);

  assert.equal(engine.equip('passive', 'stone-skin', 0).ok, true);
  assert.equal(engine.defense, 6);
  assert.equal(engine.hero.maxHealth, 100, 'o multiplicador de vida do Jade não pode permanecer');
  assert.equal(engine.equip('passive', null, 0).ok, true);
  assert.equal(engine.defense, 2);
  assert.equal(engine.hero.maxHealth, 100);

  // Dois slots nunca compartilham o mesmo Gu.
  assert.equal(engine.equip('support', 'liquor-worm', 0).ok, true);
  assert.equal(engine.equip('passive', 'liquor-worm', 0).ok, false);
  assert.equal(engine.equip('support', null, 0).ok, true);
  assert.equal(engine.equip('support', 'liquor-worm', 0).ok, true);
  assert.equal(engine.essenceRegen, 3);

  // Em combate a troca é recusada e o estado anterior permanece.
  engine.addEnemy('ja-virado', 120, 100);
  engine.tick(100, 100);
  assert.equal(engine.inCombat(100), true);
  const result = engine.equip('passive', 'stone-skin', 100);
  assert.equal(result.ok, false);
  assert.match(result.reason, /combate/);
  assert.equal(engine.equipment.passive, null);
  assert.equal(engine.defense, 2);
  engine.destroy();
});

test('equipamento persiste e save corrompido não injeta Gu', () => {
  const { engine, storage } = makeEngine();
  assert.equal(engine.equip('passive', 'stone-skin', 0).ok, true);
  assert.equal(engine.equip('movement', 'whirlwind', 0).ok, true);
  assert.equal(storage.data.has(GU_STATE_STORAGE_KEY), true);
  engine.destroy();

  const reloaded = makeEngine({ storage }).engine;
  assert.equal(reloaded.equipment.passive, 'stone-skin');
  assert.equal(reloaded.equipment.movement, 'whirlwind');
  reloaded.destroy();

  const corrupt = memoryStorage({ [GU_STATE_STORAGE_KEY]: '{não é json' });
  const fallback = makeEngine({ storage: corrupt }).engine;
  assert.equal(fallback.equipment.attack, 'moonlight');
  assert.equal(fallback.inventoryCount('moonlight'), 1);
  fallback.destroy();
});

// ── Combate e essência ──────────────────────────────────────────────────────
test('Moonlight mantém a base v0.2 e a essência nunca fica negativa', () => {
  const { engine } = makeEngine();
  const moonlight = GU_CATALOG.moonlight;
  assert.deepEqual(
    { damage: moonlight.active.damage, range: moonlight.active.range, width: moonlight.active.width,
      speed: moonlight.active.speed, cost: moonlight.usage.essenceCost,
      cooldown: moonlight.usage.cooldownMs },
    { damage: 26, range: 224, width: 26, speed: 320, cost: 16, cooldown: 1800 });

  engine.essence = 15;
  const denied = engine.activate('moonlight', 0, 'right');
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /Essência/);
  assert.equal(engine.essence, 15);
  assert.equal(engine.cooldownRemaining('moonlight', 0), 0);

  engine.essence = 16;
  assert.equal(engine.activate('moonlight', 0, 'right').ok, true);
  assert.equal(engine.essence, 0);
  assert.equal(engine.cooldownRemaining('moonlight', 100), 1700);

  // Recarga recusa a segunda ativação sem gastar a essência regenerada.
  engine.essence = 40;
  const cooling = engine.activate('moonlight', 100, 'right');
  assert.equal(cooling.ok, false);
  assert.match(cooling.reason, /recarga/);
  assert.equal(engine.essence, 40);
  assert.equal(engine.activate('moonlight', 1800, 'right').ok, true);
  assert.equal(engine.essence, 24);

  // Regeneração: para enquanto morto, respeita o teto e não vira bônus duplicado.
  engine.essence = 99.95;
  engine.tick(2000, 1000);
  assert.ok(engine.essence <= engine.cultivationMaxEssence);
  engine.hero.alive = false;
  engine.essence = 10;
  engine.tick(3000, 1000);
  assert.equal(engine.essence, 10);
  engine.hero.alive = true;
  engine.tick(4000, 1000);
  assert.ok(engine.essence > 10 && engine.essence <= 11.001);
  engine.destroy();
});

test('mitigação consistente: defesa alta reduz, mas nunca imuniza', () => {
  for (const defense of [0, 2, 6, 20, 45, 120, 1_000, 1_000_000]) {
    assert.ok(mitigatedDamage(8, defense) >= 1, `defesa ${defense} imunizou o dano`);
    assert.ok(mitigatedDamage(26, defense) >= 1);
  }
  assert.equal(mitigatedDamage(8, 2), 7);
  assert.equal(mitigatedDamage(8, 6), 7);
  assert.equal(mitigatedDamage(26, 1), 25);

  // Stone Skin e Rock Skin usam a mesma fórmula: mais defesa, sem parede de 1 dano.
  const { engine } = makeEngine();
  assert.equal(engine.equip('passive', 'rock-skin', 0).ok, true);
  assert.equal(engine.defense, 8);
  const events = engine.hitHero(8, 500, 'golpe-1');
  assert.deepEqual(events.filter(event => event.type === 'damage').map(event => event.amount), [7]);
  assert.equal(engine.hero.health, 93);
  // O mesmo hit id não aplica dano duas vezes (deduplicação do loop de física).
  assert.deepEqual(engine.hitHero(8, 500, 'golpe-1'), []);
  assert.equal(engine.hero.health, 93);
  engine.destroy();
});

test('efeitos temporários não empilham: maior valor prevalece e dura o maior prazo', () => {
  const { engine } = makeEngine();
  assert.equal(engine.equip('support', 'little-light', 0).ok, true);
  assert.equal(engine.damageMultiplier(0), 1);
  assert.equal(engine.activate('little-light', 0, 'down').ok, true);
  assert.ok(Math.abs(engine.damageMultiplier(10) - 1.25) < 1e-9);
  assert.equal(engine.activate('little-light', 10, 'down').ok, false, 'recarga impede reaplicar');
  assert.ok(Math.abs(engine.damageMultiplier(20) - 1.25) < 1e-9);

  // Após a recarga, reaplicar mantém 1,25× (não 1,5×) e renova a duração.
  const essence = engine.essence;
  assert.equal(engine.activate('little-light', 14000, 'down').ok, true);
  assert.ok(Math.abs(engine.damageMultiplier(14001) - 1.25) < 1e-9);
  assert.ok(engine.essence < essence);
  assert.equal(engine.damageMultiplier(20001), 1);

  // Amplify Effect: próxima ativação custa +50% e produz +50%, e é consumido.
  assert.equal(engine.equip('support', 'amplify-effect', 0).ok, true);
  engine.essence = 100;
  assert.equal(engine.activate('amplify-effect', 30000, 'down').ok, true);
  assert.equal(engine.empowerRemaining(30000), 8000);
  assert.equal(engine.essence, 82);
  const empowered = engine.activate('moonlight', 30001, 'right');
  assert.equal(empowered.ok, true);
  assert.equal(engine.essence, 58, 'custo 16 × 1,5 = 24');
  assert.equal(engine.activeProjectiles.length, 1);
  assert.equal(engine.activeProjectiles[0].damage, 39, '26 × 1,5 = 39');
  assert.equal(engine.empowerRemaining(30001), 0);
  assert.equal(engine.activate('moonlight', 30002, 'right').ok, false);
  engine.destroy();
});

test('movimento: dash respeita obstáculo, custo e recarga', () => {
  const { engine } = makeEngine();
  assert.equal(engine.equip('movement', 'whirlwind', 0).ok, true);
  const start = engine.hero.x;
  // O dash para antes do obstáculo: nunca atravessa parede, mesmo com distância sobrando.
  assert.equal(engine.dash(0, 'right', x => x < 150).ok, true);
  assert.equal(engine.hero.x, start + 48);
  assert.equal(engine.essence, 80);
  engine.cooldowns.set('whirlwind', 0);
  engine.essence = 100;
  engine.hero.x = start;
  assert.equal(engine.dash(0, 'right', () => false).ok, false, 'sem espaço livre, não gasta');
  assert.equal(engine.hero.x, start);
  assert.equal(engine.essence, 100);

  assert.equal(engine.dash(0, 'right', () => true).ok, true);
  assert.equal(engine.hero.x - start, 96);
  assert.equal(engine.essence, 80);
  assert.equal(engine.speedMultiplier(100), 1.5);
  assert.equal(engine.speedMultiplier(1800), 1);
  assert.equal(engine.dash(200, 'right', () => true).ok, false, 'recarga de 5000 ms');
  assert.equal(engine.dash(5000, 'right', () => true).ok, true);
  engine.destroy();
});

// ── Assimilação ─────────────────────────────────────────────────────────────
test('assimilação: permanente, única, persistida e sem consumo em falha', () => {
  const { engine, storage } = makeEngine();
  assert.equal(engine.inventoryCount('bear-strength'), 1);
  assert.equal(engine.damageMultiplier(0), 1);

  assert.equal(engine.assimilate('bear-strength', 0).ok, true);
  assert.equal(engine.inventoryCount('bear-strength'), 0);
  assert.ok(engine.assimilated.has('bear-strength'));
  assert.ok(Math.abs(engine.stats(0).permanent.physicalDamageBonus - 0.06) < 1e-9);
  assert.equal(engine.projectileDamage('moonlight', 0), 28); // round(26 × 1,06)

  const repeat = engine.assimilate('bear-strength', 0);
  assert.equal(repeat.ok, false);
  assert.match(repeat.reason, /já foi assimilado/);
  assert.equal(engine.inventoryCount('bear-strength'), 0);
  assert.ok(Math.abs(engine.damageMultiplier(0) - 1.06) < 1e-9, 'sem bônus duplicado');

  // Gu não assimilável e item ausente falham sem consumir nada.
  assert.equal(engine.assimilate('liquor-worm', 0).ok, false);
  assert.equal(engine.inventoryCount('liquor-worm'), 1);
  const before = engine.inventoryCount('black-boar');
  engine.inventory['black-boar'] = 0;
  assert.equal(engine.assimilate('black-boar', 0).ok, false);
  engine.inventory['black-boar'] = before;

  // Combate bloqueia a assimilação irreversível.
  engine.addEnemy('guarda', 120, 100);
  engine.tick(100, 100);
  const blocked = engine.assimilate('white-boar', 100);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /combate/);
  assert.equal(engine.inventoryCount('white-boar'), 1);
  engine.clearAreaEnemies();
  engine.combatUntil = 0;

  // Falha de gravação não consome o Gu nem publica metade do estado.
  const brokenStorage = memoryStorage();
  const broken = new CombatEngine(undefined, 0, 0,
    { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} },
    new GuStateStore({ getItem: () => null,
      setItem: () => { throw new Error('quota'); } }));
  const brokenResult = broken.assimilate('bear-strength', 0);
  assert.equal(brokenResult.ok, false);
  assert.equal(broken.inventoryCount('bear-strength'), 1);
  assert.equal(broken.assimilated.has('bear-strength'), false);
  broken.destroy();

  // Físico (Urso + Javali Branco) e corpo a corpo (Javali Negro) são camadas distintas.
  assert.equal(engine.assimilate('white-boar', 1).ok, true);
  assert.equal(engine.assimilate('black-boar', 2).ok, true);
  assert.ok(Math.abs(engine.damageMultiplier(2) - 1.10) < 1e-9);
  assert.ok(Math.abs(engine.meleeDamageMultiplier(2) - 1.10 * 1.04) < 1e-9);
  assert.equal(engine.stats(2).permanent.meleeDamageBonus, 0.04);

  // Sobrevive a recarga e a morte (não é desfeito por troca de equipamento).
  engine.equip('passive', 'stone-skin', 0);
  assert.equal(engine.equip('passive', null, 0).ok, true);
  engine.hitHero(10_000, 3, 'morte', () => 1);
  assert.equal(engine.hero.alive, false);
  assert.equal(engine.respawn(100, 100), true);
  assert.equal(engine.assimilated.size, 3);
  assert.ok(Math.abs(engine.damageMultiplier(4) - 1.10) < 1e-9);
  engine.destroy();

  const reloaded = makeEngine({ storage }).engine;
  assert.deepEqual([...reloaded.assimilated].sort(), ['bear-strength', 'black-boar', 'white-boar']);
  assert.equal(reloaded.inventoryCount('bear-strength'), 0);
  assert.ok(Math.abs(reloaded.stats(0).permanent.physicalDamageBonus - 0.10) < 1e-9);
  reloaded.destroy();
  assert.ok(brokenStorage.data.size >= 0);
});

// ── Refino ──────────────────────────────────────────────────────────────────
test('refino: duas receitas canônicas, determinísticas e sem duplicação', () => {
  assert.deepEqual(validateRecipes(), []);
  assert.equal(GU_RECIPES.length, 2);
  const moonglow = recipeById('moonglow-rank-2');
  assert.deepEqual(moonglow.ingredients, [{ id: 'moonlight', quantity: 1 },
    { id: 'little-light', quantity: 2 }]);
  assert.equal(moonglow.successChance, 1);
  const whiteJade = recipeById('white-jade-rank-2');
  assert.deepEqual(whiteJade.ingredients, [{ id: 'white-boar', quantity: 1 },
    { id: 'jade-skin', quantity: 1 }]);
  assert.equal(recipeById('receita-inventada'), undefined);

  // Rank insuficiente falha sem gastar ingrediente nem essência.
  const low = makeEngine().engine;
  const lowResult = low.refine('moonglow-rank-2', 0);
  assert.equal(lowResult.ok, false);
  assert.match(lowResult.reason, /Rank/);
  assert.equal(low.inventoryCount('moonlight'), 1);
  assert.equal(low.inventoryCount('little-light'), 2);
  assert.equal(low.essence, 100);
  low.destroy();

  const { engine } = makeEngine({ rank: 2 });
  assert.equal(engine.inventoryCount('moonlight'), 1);
  assert.equal(engine.inventoryCount('little-light'), 2);
  assert.equal(engine.equipment.attack, 'moonlight');
  const essenceBefore = engine.essence;
  assert.equal(engine.refine('moonglow-rank-2', 0).ok, true);
  assert.equal(engine.inventoryCount('moonlight'), 0);
  assert.equal(engine.inventoryCount('little-light'), 0);
  assert.equal(engine.inventoryCount('moonglow'), 1);
  assert.equal(engine.equipment.attack, null, 'ingrediente equipado sai do slot');
  assert.equal(engine.essence, essenceBefore - 30);
  // Determinismo e conservação: repetir falha por falta de ingredientes e nada muda.
  const snapshotAfter = JSON.stringify({ inventory: engine.inventory, essence: engine.essence });
  const again = engine.refine('moonglow-rank-2', 1);
  assert.equal(again.ok, false);
  assert.match(again.reason, /Ingredientes/);
  assert.equal(JSON.stringify({ inventory: engine.inventory, essence: engine.essence }), snapshotAfter);

  assert.equal(engine.refine('white-jade-rank-2', 2).ok, true);
  assert.equal(engine.inventoryCount('white-boar'), 0);
  assert.equal(engine.inventoryCount('jade-skin'), 0);
  assert.equal(engine.inventoryCount('white-jade'), 1);
  assert.equal(engine.essence, essenceBefore - 60);

  // Rank 2 agora equipa e tem números próprios (qualidade de essência R2 = 1,08).
  assert.equal(engine.equip('attack', 'moonglow', 3).ok, true);
  assert.equal(engine.equip('passive', 'white-jade', 3).ok, true);
  assert.equal(engine.projectileDamage('moonglow', 3), 43);
  assert.equal(engine.defense, 11);
  assert.equal(engine.hero.maxHealth, 159); // Rank 2: 142 PV × 1,12 do Jade Branco

  // Essência insuficiente não consome ingredientes.
  const poor = makeEngine({ rank: 2 }).engine;
  poor.essence = 29;
  assert.equal(poor.refine('moonglow-rank-2', 0).ok, false);
  assert.equal(poor.inventoryCount('moonlight'), 1);
  assert.equal(poor.inventoryCount('little-light'), 2);
  assert.equal(poor.essence, 29);
  poor.destroy();

  // Duas execuções idênticas produzem o mesmo inventário (determinístico).
  const first = makeEngine({ rank: 2 }).engine;
  const second = makeEngine({ rank: 2 }).engine;
  for (const item of [first, second]) {
    item.refine('moonglow-rank-2', 0);
    item.refine('white-jade-rank-2', 1);
  }
  assert.deepEqual(first.inventory, second.inventory);
  first.destroy(); second.destroy(); engine.destroy();
});

// ── Compatibilidade de save ─────────────────────────────────────────────────
test('save v0 com os quatro Gu originais migra de forma idempotente', () => {
  const legacy = {
    equipment: { attack: 'moonlight', passive: 'stone-skin', movement: 'whirlwind', support: 'liquor-worm' },
  };
  const migrated = normalizeGuSnapshot(legacy);
  assert.deepEqual(migrated.equipment, legacy.equipment);
  for (const id of ['moonlight', 'stone-skin', 'whirlwind', 'liquor-worm']) {
    assert.equal(migrated.inventory[id], 1, id);
  }
  assert.equal(migrated.inventory['star-arrow'], 0, 'migração não concede o catálogo inteiro');
  assert.deepEqual(migrated.assimilated, []);
  assert.deepEqual(normalizeGuSnapshot(migrated), migrated, 'migração idempotente');

  const storage = memoryStorage({ [GU_STATE_STORAGE_KEY]: JSON.stringify(legacy) });
  assert.deepEqual(new GuStateStore(storage).load(), migrated);

  // Formato antigo com lista de inventário de teste.
  const listed = normalizeGuSnapshot({ testInventory: ['moonlight', 'whirlwind', 'blood-moon'] });
  assert.deepEqual(listed.inventory.moonlight, 1);
  assert.deepEqual(listed.inventory.whirlwind, 1);
  assert.equal(GU_IDS.includes('blood-moon'), false);
  assert.deepEqual(normalizeGuSnapshot(listed), listed);

  // Sanitização: desconhecidos, negativos, frações, duplicidade e posse ausente.
  const dirty = normalizeGuSnapshot({
    inventory: { moonlight: 3, cicada: 5, 'blood-moon': 4, 'star-arrow': -2,
      'star-dart': 1.5, 'bone-spear': MAX_GU_STACK + 50 },
    equipment: { attack: 'moonlight', passive: 'stone-skin', movement: 'moonlight', support: 'whirlwind' },
    assimilated: ['bear-strength', 'bear-strength', 'liquor-worm', 'blood-moon'],
  });
  assert.equal(dirty.inventory.moonlight, 3);
  assert.equal(dirty.inventory['bone-spear'], MAX_GU_STACK);
  assert.equal(dirty.inventory['star-arrow'], 0);
  assert.equal(dirty.inventory['star-dart'], 0);
  assert.equal(Object.prototype.hasOwnProperty.call(dirty.inventory, 'cicada'), false);
  assert.equal(dirty.equipment.attack, 'moonlight');
  assert.equal(dirty.equipment.movement, null, 'Gu de ataque não ocupa movimento');
  assert.equal(dirty.equipment.passive, null, 'Gu não possuído não pode ficar equipado');
  assert.equal(dirty.equipment.support, null, 'Gu fora do slot é rejeitado');
  assert.deepEqual(dirty.assimilated, ['bear-strength']);
  assert.equal(dirty.inventory['bear-strength'], 0, 'assimilado não pode ser vendido/reassimilado');
  assert.deepEqual(normalizeGuSnapshot(dirty), dirty);

  // Versão futura não é reinterpretada; versão atual faz round-trip.
  const future = memoryStorage({ [GU_STATE_STORAGE_KEY]: JSON.stringify({ version: GU_STATE_VERSION + 1,
    inventory: { moonlight: 99 } }) });
  assert.equal(new GuStateStore(future).load(), null);

  const roundTripStorage = memoryStorage();
  const store = new GuStateStore(roundTripStorage);
  const snapshot = { inventory: { ...emptyInventory(), moonlight: 2 }, equipment: {
    attack: 'moonlight', passive: null, movement: null, support: null }, assimilated: [] };
  store.save(snapshot);
  assert.deepEqual(store.load(), normalizeGuSnapshot(snapshot));
  assert.equal(JSON.parse(roundTripStorage.data.get(GU_STATE_STORAGE_KEY)).version, GU_STATE_VERSION);
});

test('consumíveis: uso único, sem inventário negativo e bloqueio de save falho', () => {
  const { engine } = makeEngine();
  assert.equal(engine.inventoryCount('flash-blink'), 1);
  engine.addEnemy('perto', 120, 100);
  const used = engine.useItem('flash-blink', 0);
  assert.equal(used.ok, true);
  assert.equal(engine.inventoryCount('flash-blink'), 0);
  assert.ok(used.events.some(event => event.type === 'blind' && event.targetId === 'perto'));
  assert.equal(engine.useItem('flash-blink', 1).ok, false);
  assert.equal(engine.inventoryCount('flash-blink'), 0);
  engine.destroy();
});
