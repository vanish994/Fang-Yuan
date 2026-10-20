import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';

const root = new URL('../', import.meta.url);
const combat = readFileSync(new URL('src/combat/combatEngine.ts', root), 'utf8');
const mitigation = readFileSync(new URL('src/combat/damageFormula.ts', root), 'utf8');
const mobs = readFileSync(new URL('src/combat/mobCatalog.ts', root), 'utf8');
const cultivation = readFileSync(new URL('src/entities/cultivationCombat.ts', root), 'utf8');
const { cultivationCombatStats } = await import(moduleURL('entities/cultivationCombat'));
const catalog = readFileSync(new URL('src/combat/guCatalog.ts', root), 'utf8');

function mitigatedDamage(amount, defense) {
  return Math.max(1, Math.floor(amount * 100 / (100 + Math.max(0, defense))));
}

test('mitigação não cria parede de 1 dano contra chefes', () => {
  assert.equal(mitigatedDamage(14, 2), 13);
  assert.equal(mitigatedDamage(14, 20), 11);
  assert.equal(mitigatedDamage(14, 45), 9);
  assert.ok(mitigatedDamage(14, 80) >= 7);
  assert.match(mitigation, /amount \* 100 \/ \(100 \+ Math\.max\(0, defense\)\)/);
  // A defesa efetiva nunca ignora a fórmula: passivos de Gu selvagem entram
  // como defesa adicional (Bronze Skin condicional incluído), não como imunidade.
  assert.match(combat, /mitigatedDamage\(amount, this\.enemyDefense\(enemy\)\)/);
  assert.match(combat, /enemy\.defense \+ \(lowActive \? low : 0\)/);
});

test('Moonlight mantém a base e escala pela qualidade da essência, não pelo ataque bruto', () => {
  // Valores canônicos do Rank 1 vivem em um único módulo (guCatalog).
  assert.match(catalog, /define\('moonlight', \{[\s\S]*?damage: 26, range: 224, width: 26, speed: 320/);
  assert.match(catalog, /define\('moonlight', \{[\s\S]*?essenceCost: 16, cooldownMs: 1800/);
  assert.match(combat, /get moonlightDamage/);
  assert.match(combat, /this\.projectileDamage\('moonlight', this\.lastNow\)/);
  assert.match(combat, /active\.damage \* this\.essenceQuality/);
});

test('fauna segue uma curva de risco e não usa mais os placeholders antigos', () => {
  assert.match(mobs, /Javali Selvagem', 1, .*45, 2, 9/);
  assert.match(mobs, /Lobo Feroz', 2, .*120, 7, 22/);
  assert.match(mobs, /Urso Demoníaco', 3, .*420, 22, 55/);
  assert.match(mobs, /Besta Demoníaca Antiga', 'boss'.*3500, 80, 180/);
  assert.doesNotMatch(mobs, /600, 10, 85/);
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
