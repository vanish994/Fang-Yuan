import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const combat = readFileSync(new URL('src/combat/combatEngine.ts', root), 'utf8');
const mitigation = readFileSync(new URL('src/combat/damageFormula.ts', root), 'utf8');
const mobs = readFileSync(new URL('src/combat/mobCatalog.ts', root), 'utf8');
const cultivation = readFileSync(new URL('src/entities/cultivationCombat.ts', root), 'utf8');
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

test('curva de cultivo declara 36 estados e ordem por Rank', () => {
  assert.match(cultivation, /Array\.from\(\{? length: 9/);
  assert.match(cultivation, /R1 Inicial → R1 Pico → R2 Inicial/);
});
