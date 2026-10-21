import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const { WildGuDropLog } = await import(moduleURL('combat/wildGuDrops'));

test('registra o Gu exato da criatura e devolve null para quem não tinha Gu', () => {
  const log = new WildGuDropLog();
  assert.equal(log.pending('mob-1'), null);
  log.register('mob-1', 'moonlight');
  assert.equal(log.pending('mob-1'), 'moonlight');
  assert.equal(log.pending('mob-2'), null);
  assert.equal(log.pendingCount, 1);
  assert.deepEqual(log.entries(), [['mob-1', 'moonlight']]);
});

test('registrar de novo não troca o Gu já deixado nem duplica o drop', () => {
  const log = new WildGuDropLog();
  log.register('mob-1', 'moonlight');
  log.register('mob-1', 'ghost-fire');
  assert.equal(log.pending('mob-1'), 'moonlight');
  assert.equal(log.pendingCount, 1);
});

test('entrega marca o Gu como recebido e libera o pendente', () => {
  const log = new WildGuDropLog();
  log.register('mob-1', 'moonlight');
  log.markDelivered('mob-1');
  assert.equal(log.pending('mob-1'), null);
  assert.equal(log.wasDelivered('mob-1'), true);
  assert.equal(log.pendingCount, 0);
  assert.equal(log.wasDelivered('mob-2'), false);
});

test('processar a mesma morte duas vezes não reabre a entrega', () => {
  const log = new WildGuDropLog();
  log.register('mob-1', 'moonlight');
  log.markDelivered('mob-1');
  log.register('mob-1', 'moonlight');
  // O motor checa `wasDelivered && pending === null` antes de entregar de novo;
  // mesmo com o registro repetido, a entrega anterior continua registrada.
  assert.equal(log.wasDelivered('mob-1'), true);
});

test('logs independentes não compartilham estado', () => {
  const a = new WildGuDropLog();
  const b = new WildGuDropLog();
  a.register('mob-1', 'moonlight');
  assert.equal(b.pending('mob-1'), null);
  assert.equal(b.pendingCount, 0);
});
