import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleURL } from './support/tsModule.mjs';


const { cultivationCombatStats } = await import(moduleURL('entities/cultivationCombat'));
const { GU_CATALOG } = await import(moduleURL('combat/guCatalog'));
const { TEST_MOBS } = await import(moduleURL('combat/mobCatalog'));
const { mitigatedDamage: realMitigation } = await import(moduleURL('combat/damageFormula'));
const { CombatEngine } = await import(moduleURL('combat/combatEngine'));
const { COMBAT_CONFIG } = await import(moduleURL('combat/combatConfig'));

function mitigatedDamage(amount, defense) {
  return Math.max(1, Math.floor(amount * 100 / (100 + Math.max(0, defense))));
}

test('mitigação não cria parede de 1 dano contra chefes', () => {
  assert.equal(mitigatedDamage(14, 2), 13);
  assert.equal(mitigatedDamage(14, 20), 11);
  assert.equal(mitigatedDamage(14, 45), 9);
  assert.ok(mitigatedDamage(14, 80) >= 7);
  // A tabela acima precisa ser a mesma função que o jogo usa (comparação
  // numérica, não texto do fonte).
  for (const amount of [1, 7, 14, 26, 40, 120, 420]) {
    for (const defense of [-5, 0, 2, 7, 22, 45, 80, 500]) {
      assert.equal(mitigatedDamage(amount, defense), realMitigation(amount, defense),
        `divergência em dano ${amount} x defesa ${defense}`);
    }
  }
});

test('defesa alta reduz o dano, mas nunca zera (sem imunidade por empilhamento)', () => {
  const defenseOf = (defense, healthRatio = 1, wild) => {
    const engine = new CombatEngine(COMBAT_CONFIG, 100, 100);
    const enemy = engine.addEnemy('alvo', 112, 100, 100, undefined, wild);
    enemy.defense = defense;
    enemy.health = 100 * healthRatio;
    enemy.maxHealth = 100;
    engine.select('alvo');
    const hit = engine.basicAttack(1_000).events.find(event => event.type === 'damage');
    return hit ? hit.amount : 0;
  };

  const semDefesa = defenseOf(0);
  const comDefesa = defenseOf(45);
  const absurda = defenseOf(5_000);
  assert.ok(semDefesa > comDefesa, 'defesa precisa reduzir o dano');
  assert.ok(absurda >= 1, `defesa extrema não pode zerar o dano (recebeu ${absurda})`);

  // Bronze Skin: defesa condicional abaixo de 50% de vida — soma, não imuniza.
  const cheio = defenseOf(0, 1, { forcedWildGu: 'bronze-skin' });
  const ferido = defenseOf(0, 0.4, { forcedWildGu: 'bronze-skin' });
  assert.ok(ferido < cheio, 'o passivo de vida baixa precisa endurecer a criatura');
  assert.ok(ferido >= 1);
});

test('Moonlight mantém a base e escala pela qualidade da essência, não pelo ataque bruto', () => {
  // Valores canônicos do Rank 1 vivem em um único módulo (guCatalog): agora
  // lidos como dado, não como texto do fonte.
  const gu = GU_CATALOG.moonlight;
  assert.equal(gu.active.kind, 'projectile');
  assert.deepEqual(
    { damage: gu.active.damage, range: gu.active.range, width: gu.active.width, speed: gu.active.speed },
    { damage: 26, range: 224, width: 26, speed: 320 });
  assert.deepEqual({ cost: gu.usage.essenceCost, cooldown: gu.usage.cooldownMs }, { cost: 16, cooldown: 1800 });

  // Comportamento: o dano anunciado é `base × qualidade da essência × buffs`,
  // e o motor expõe exatamente a mesma conta usada no disparo.
  const engine = new CombatEngine(COMBAT_CONFIG, 100, 100);
  const expected = Math.max(1, Math.round(26 * engine.essenceQuality * 1));
  assert.equal(engine.moonlightDamage, expected);
  // O ataque bruto do personagem não entra na fórmula.
  assert.ok(expected <= 26 * 1.15, 'qualidade de R1 não pode inflar o dano base');
});

test('fauna segue uma curva de risco e não usa mais os placeholders antigos', () => {
  const byName = name => TEST_MOBS.find(mob => mob.name === name);
  const curve = name => {
    const mob = byName(name);
    assert.ok(mob, `${name} precisa existir no catálogo`);
    return { tier: mob.tier, health: mob.health, defense: mob.defense, damage: mob.damage };
  };
  assert.deepEqual(curve('Javali Selvagem'), { tier: 1, health: 45, defense: 2, damage: 9 });
  assert.deepEqual(curve('Lobo Feroz'), { tier: 2, health: 120, defense: 7, damage: 22 });
  assert.deepEqual(curve('Urso Demoníaco'), { tier: 3, health: 420, defense: 22, damage: 55 });
  assert.deepEqual(curve('Besta Demoníaca Antiga'), { tier: 'boss', health: 3500, defense: 80, damage: 180 });
  // O placeholder antigo (600 de vida, 10 de defesa, 85 de dano) não existe mais.
  assert.equal(TEST_MOBS.filter(mob => mob.health === 600 && mob.defense === 10 && mob.damage === 85).length, 0);
});

test('curva de cultivo cobre os 36 estados e cresce por Rank e por estágio', () => {
  // Antes isto era um assert sobre o texto do fonte, cobrindo uma constante
  // exportada que nenhum código usava. Agora verifica o comportamento real.
  const stages = ['Inicial', 'Médio', 'Superior', 'Pico'];
  const states = [];
  for (let rank = 1; rank <= 9; rank += 1) for (const stage of stages) states.push({ rank, stage });
  assert.equal(states.length, 36);

  const stats = states.map(state => cultivationCombatStats(state));
  assert.ok(stats.every(entry => entry.maxHealth > 0 && entry.attack > 0
    && entry.defense > 0 && entry.maxEssence > 0), 'nenhum estado pode ficar sem atributos');

  // Ordem canônica: R1 Inicial → R1 Pico → R2 Inicial → ... → R9 Pico.
  for (let index = 1; index < stats.length; index += 1) {
    assert.ok(stats[index].maxHealth > stats[index - 1].maxHealth,
      `vida deve crescer de ${JSON.stringify(states[index - 1])} para ${JSON.stringify(states[index])}`);
    assert.ok(stats[index].attack >= stats[index - 1].attack);
    assert.ok(stats[index].defense >= stats[index - 1].defense);
  }
  // O Rank precisa valer ao menos o maior salto de estágio. Hoje os dois valem
  // 12 PV (R1 Pico 130 → R2 Inicial 142 vs. R1 Superior 118 → Pico 130): o
  // contrato do GDD diz que o Rank é o salto principal, mas na fronteira ele
  // empata com o último estágio. Registrado como pendência de balanceamento em
  // docs/ANALISE-MELHORIAS.md; os valores canônicos não foram alterados aqui.
  const rankJump = cultivationCombatStats({ rank: 2, stage: 'Inicial' }).maxHealth
    - cultivationCombatStats({ rank: 1, stage: 'Pico' }).maxHealth;
  const biggestStageJump = Math.max(...[1, 2, 3].map(index =>
    cultivationCombatStats({ rank: 1, stage: stages[index] }).maxHealth
    - cultivationCombatStats({ rank: 1, stage: stages[index - 1] }).maxHealth));
  assert.ok(rankJump >= biggestStageJump,
    `salto de Rank (${rankJump}) não pode ser menor que o maior salto de estágio (${biggestStageJump})`);
});
