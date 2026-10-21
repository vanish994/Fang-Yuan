import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const { RespawnQueue, respawnDelay, RESPAWN_MIN_MS, RESPAWN_MAX_MS, RESPAWN_RETRY_MS,
  BOSS_RESPAWN_MIN_MS, BOSS_RESPAWN_MAX_MS,
  RESPAWN_MIN_PLAYER_DISTANCE } = await import(moduleURL('world/mobRespawn'));

test('cada criatura volta entre 60 e 90 segundos', () => {
  const keys = ['floresta_exterior:mob-wild-boar', 'cavernas:mob-demon-bear',
    'santuario_besta:mob-ancient-demonic-beast'];
  for (const key of keys) {
    const delay = respawnDelay(key);
    assert.ok(delay >= RESPAWN_MIN_MS && delay <= RESPAWN_MAX_MS, `${key}: ${delay}`);
    assert.equal(delay, respawnDelay(key), 'o intervalo precisa ser estável');
  }
});

test('chefe demora muito mais que a fauna comum', () => {
  const key = 'covil_lobo:mob-grey-wolf-king';
  const bossDelay = respawnDelay(key, true);
  assert.ok(bossDelay >= BOSS_RESPAWN_MIN_MS && bossDelay <= BOSS_RESPAWN_MAX_MS, `${bossDelay}`);
  assert.ok(bossDelay > respawnDelay(key) * 3, 'chefe não pode virar farm de 90 s');
  assert.equal(respawnDelay(key, true), respawnDelay(key, true));
});

test('criaturas diferentes não voltam todas no mesmo instante', () => {
  const delays = new Set();
  for (let index = 0; index < 30; index += 1) {
    delays.add(respawnDelay(`floresta_exterior:mob-wild-boar-extra-${index}`));
  }
  assert.ok(delays.size > 10, `pouca variação de intervalos: ${delays.size}`);
});

test('a fila agenda, devolve o vencido e só limpa depois do nascimento', () => {
  const queue = new RespawnQueue();
  const dueAt = queue.schedule('area:mob', 1_000);
  assert.equal(queue.size, 1);
  assert.equal(queue.dueAt('area:mob'), dueAt);
  assert.deepEqual(queue.due(dueAt - 1), []);
  assert.deepEqual(queue.due(dueAt), ['area:mob']);
  // Continua pendente: quem decide se pode nascer é a cena.
  assert.equal(queue.size, 1);
  queue.settle('area:mob');
  assert.equal(queue.size, 0);
  assert.equal(queue.dueAt('area:mob'), undefined);
});

test('o prazo pode ser informado pela cena (chefe x fauna)', () => {
  const queue = new RespawnQueue();
  const bossAt = queue.schedule('area:chefe', 0, respawnDelay('area:chefe', true));
  const mobAt = queue.schedule('area:mob', 0, respawnDelay('area:mob'));
  assert.equal(queue.dueAt('area:chefe'), bossAt);
  assert.equal(queue.dueAt('area:mob'), mobAt);
  assert.ok(bossAt > mobAt);
});

test('agendar duas vezes a mesma criatura não duplica nem reinicia o prazo', () => {
  const queue = new RespawnQueue();
  const first = queue.schedule('area:mob', 0);
  const second = queue.schedule('area:mob', 30_000);
  assert.equal(first, second);
  assert.equal(queue.size, 1);
  assert.equal(queue.dueAt('area:mob'), first);
});

test('adiar mantém a criatura na fila para tentar de novo', () => {
  const queue = new RespawnQueue();
  const dueAt = queue.schedule('area:mob', 0);
  queue.postpone('area:mob', dueAt);
  assert.equal(queue.size, 1);
  assert.equal(queue.dueAt('area:mob'), dueAt + RESPAWN_RETRY_MS);
  assert.deepEqual(queue.due(dueAt + RESPAWN_RETRY_MS - 1), []);

  // Adiar uma chave desconhecida não cria entrada fantasma.
  queue.postpone('area:outro', 0);
  assert.equal(queue.size, 1);
});

test('vencidas são devolvidas da mais antiga para a mais nova', () => {
  const queue = new RespawnQueue();
  queue.schedule('area:a', 0);
  queue.schedule('area:b', 5_000);
  const now = 120_000;
  const due = queue.due(now).sort((a, b) => (queue.dueAt(a) ?? 0) - (queue.dueAt(b) ?? 0));
  assert.deepEqual(due, ['area:a', 'area:b']);
  assert.ok((queue.dueAt('area:a') ?? 0) < (queue.dueAt('area:b') ?? 0));
});

test('cancelar e limpar removem pendências e a distância mínima é positiva', () => {
  const queue = new RespawnQueue();
  queue.schedule('area:a', 0);
  queue.schedule('area:b', 0);
  queue.cancel('area:a');
  assert.deepEqual(queue.keys, ['area:b']);
  queue.clear();
  assert.equal(queue.size, 0);
  assert.ok(RESPAWN_MIN_PLAYER_DISTANCE >= 64, 'mob não pode nascer em cima do jogador');
});
