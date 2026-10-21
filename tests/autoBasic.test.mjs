import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';

const { autoBasicDecision, meleeLineBlocked } = await import(moduleURL('combat/autoBasic'));

const ready = {
  alive: true, target: { x: 130, y: 100 }, hero: { x: 100, y: 100 },
  range: 62, cooldownRemaining: 0, blocked: false, moving: false,
};

test('básico automático: bate no alcance, espera fora dele e desarma sem alvo', () => {
  assert.equal(autoBasicDecision(ready), 'attack');
  // Recarga em andamento: mantém armado e não gasta o golpe.
  assert.equal(autoBasicDecision({ ...ready, cooldownRemaining: 240 }), 'hold');
  // Fora de alcance: espera o alvo chegar em vez de bombardear o HUD de erros.
  assert.equal(autoBasicDecision({ ...ready, target: { x: 200, y: 100 } }), 'hold');
  // Corpo a corpo com parede no meio: espera.
  assert.equal(autoBasicDecision({ ...ready, blocked: true }), 'hold');
  // Alvo morto (motor limpa a seleção), herói morto ou jogador andando: desarma.
  assert.equal(autoBasicDecision({ ...ready, target: null }), 'stop');
  assert.equal(autoBasicDecision({ ...ready, alive: false }), 'stop');
  assert.equal(autoBasicDecision({ ...ready, moving: true }), 'stop');
  // O alcance é do personagem em campo: 62 px no corpo a corpo, 190 px à distância.
  assert.equal(autoBasicDecision({ ...ready, target: { x: 180, y: 100 }, range: 190 }), 'attack');
});

test('parede entre os dois interrompe a linha do corpo a corpo', () => {
  // `isFree` é o teste de tile livre do mundo: falso = parede.
  const onlyPast115 = x => x >= 115;
  assert.equal(meleeLineBlocked({ x: 100, y: 100 }, { x: 130, y: 100 }, onlyPast115), true);
  assert.equal(meleeLineBlocked({ x: 120, y: 100 }, { x: 130, y: 100 }, onlyPast115), false);
  // Alvo no mesmo ponto não testa nada.
  assert.equal(meleeLineBlocked({ x: 100, y: 100 }, { x: 100, y: 100 }, () => false), false);
});

test('toque no inimigo arma o automático; andar, trocar de alvo e morrer desarmam', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  // Clique no inimigo seleciona e arma, em vez de só selecionar.
  assert.match(main, /if \(!this\.combat\.select\(enemy\.id\)\) return;\s*\n\s*this\.armAutoBasic\(/);
  // Um clique no chão é movimento: o walkTo desarma antes de traçar a rota.
  const walkTo = main.slice(main.indexOf('private walkTo('), main.indexOf('private update('));
  assert.match(walkTo, /this\.disarmAutoBasic\(\);/);
  // Joystick, arremetida, troca de personagem, morte e troca de área também.
  assert.ok(main.match(/disarmAutoBasic/g).length >= 6);
  assert.match(main, /if \(action === 'respawn'\) \{\s*\n\s*this\.disarmAutoBasic\(\);/);
  assert.match(main, /event\.type === 'hero-death'\) \{\s*\n\s*this\.disarmAutoBasic\(\);/);
  // A cadência é a da recarga do básico: o quadro só chama o golpe quando zera.
  assert.match(main, /cooldownRemaining: this\.combat\.cooldownRemaining\('basic', now\)/);
  assert.match(main, /if \(decision === 'attack'\) this\.onCombatAction\('basic'\)/);
  // Indicação visual no botão Básico, sem criar um segundo estado de combate.
  assert.match(hud, /setAutoBasic\(armed: boolean\)/);
  assert.match(hud, /basic\.toggleAttribute\('data-auto', armed\)/);
});
