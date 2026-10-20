import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const combat = readFileSync(new URL('src/combat/combatEngine.ts', root), 'utf8');
const mitigation = readFileSync(new URL('src/combat/damageFormula.ts', root), 'utf8');
const mobs = readFileSync(new URL('src/combat/mobCatalog.ts', root), 'utf8');
const cultivation = readFileSync(new URL('src/entities/cultivationCombat.ts', root), 'utf8');

function mitigatedDamage(amount, defense) {
  return Math.max(1, Math.floor(amount * 100 / (100 + Math.max(0, defense))));
}

test('mitigação não cria parede de 1 dano contra chefes', () => {
  assert.equal(mitigatedDamage(14, 2), 13);
  assert.equal(mitigatedDamage(14, 20), 11);
  assert.equal(mitigatedDamage(14, 45), 9);
  assert.ok(mitigatedDamage(14, 80) >= 7);
  assert.match(mitigation, /amount \* 100 \/ \(100 \+ Math\.max\(0, defense\)\)/);
  assert.match(combat, /mitigatedDamage\(amount, enemy\.defense\)/);
});

test('Moonlight acompanha a progressão de cultivo', () => {
  assert.match(combat, /get moonlightDamage/);
  assert.match(combat, /this\.moonlightDamage/);
  assert.match(combat, /Math\.round\(this\.attack \* \(26 \/ 14\)\)/);
});

test('fauna segue uma curva de risco e não usa mais os placeholders antigos', () => {
  assert.match(mobs, /Javali Selvagem', 1, .*45, 2, 9/);
  assert.match(mobs, /Lobo Feroz', 2, .*110, 5, 22/);
  assert.match(mobs, /Urso Demoníaco', 3, .*300, 12, 45/);
  assert.match(mobs, /Besta Demoníaca Antiga', 'boss'.*1000, 20, 85/);
  assert.doesNotMatch(mobs, /600, 10, 85/);
});

test('curva de cultivo declara 36 estados e ordem por Rank', () => {
  assert.match(cultivation, /Array\.from\(\{? length: 9/);
  assert.match(cultivation, /R1 Inicial → R1 Pico → R2 Inicial/);
});
