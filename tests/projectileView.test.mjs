import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const viewURL = moduleURL('ui/projectileView');
const { directionRotation, guColor, placementOf, syncPool, bladeShape, orbShape } =
  await import(viewURL);

test('rotação cardinal aponta o desenho para a direção do disparo', () => {
  assert.equal(directionRotation('right'), 0);
  assert.equal(directionRotation('left'), Math.PI);
  assert.equal(directionRotation('up'), -Math.PI / 2);
  assert.equal(directionRotation('down'), Math.PI / 2);
  // As quatro direções são distintas: nenhuma colapsa na outra.
  const all = ['right', 'left', 'up', 'down'].map(directionRotation);
  assert.equal(new Set(all).size, 4);
});

test('cor do catálogo vira inteiro e degrada para branco em valor inválido', () => {
  assert.equal(guColor('#f1e6a8'), 0xf1e6a8);
  assert.equal(guColor('#000000'), 0);
  assert.equal(guColor('#FFFFFF'), 0xffffff);
  assert.equal(guColor('#zzzzzz'), 0xffffff, 'entrada inválida não vira NaN');
  assert.equal(guColor(''), 0xffffff);
});

test('posicionamento acompanha o projétil e a direção', () => {
  assert.deepEqual(placementOf({ x: 10, y: 20, direction: 'right' }),
    { x: 10, y: 20, rotation: 0 });
  assert.deepEqual(placementOf({ x: -5, y: 0, direction: 'down' }),
    { x: -5, y: 0, rotation: Math.PI / 2 });
  // Nada de NaN com coordenadas fracionárias (movimento é sub-pixel).
  const fractional = placementOf({ x: 10.5, y: -0.25, direction: 'up' });
  assert.equal(fractional.x, 10.5);
  assert.equal(fractional.y, -0.25);
});

test('syncPool cresce, encolhe e preserva a ordem', () => {
  const created = [];
  const destroyed = [];
  const pool = [];
  const create = () => { const item = { id: created.length }; created.push(item); return item; };
  const destroy = item => destroyed.push(item);

  syncPool(pool, 3, create, destroy);
  assert.equal(pool.length, 3);
  assert.deepEqual(pool.map(item => item.id), [0, 1, 2]);
  assert.equal(created.length, 3);

  // Encolher destrói só o excedente, do fim para o começo.
  syncPool(pool, 1, create, destroy);
  assert.deepEqual(pool.map(item => item.id), [0]);
  assert.deepEqual(destroyed.map(item => item.id), [2, 1]);

  // Crescer de novo reaproveita o que sobrou e cria só a diferença.
  syncPool(pool, 2, create, destroy);
  assert.equal(pool.length, 2);
  assert.equal(created.length, 4);
  assert.equal(pool[0].id, 0);
});

test('syncPool com zero destrói tudo e não cria nada', () => {
  let created = 0;
  const destroyed = [];
  const pool = [{ id: 1 }, { id: 2 }];
  syncPool(pool, 0, () => { created += 1; return {}; }, item => destroyed.push(item));
  assert.equal(pool.length, 0);
  assert.equal(created, 0);
  assert.equal(destroyed.length, 2);
});

test('syncPool não mexe no pool quando a contagem já está certa', () => {
  let touched = 0;
  const pool = [{ id: 1 }];
  syncPool(pool, 1, () => { touched += 1; return {}; }, () => { touched += 1; });
  assert.equal(touched, 0);
  assert.equal(pool.length, 1);
});

test('lâmina tem raio coerente com a largura e nunca degenera', () => {
  assert.deepEqual(bladeShape(26), { radius: 13, inner: 9 });
  assert.deepEqual(bladeShape(8), { radius: 4, inner: 5 }, 'largura mínima não gera raio 0');
  const tiny = bladeShape(0);
  assert.ok(tiny.radius >= 4);
  assert.ok(tiny.inner >= 5, 'o arco interno nunca inverte o desenho');
  for (const width of [1, 12, 26, 40, 120]) {
    const shape = bladeShape(width);
    assert.ok(shape.radius > 0 && shape.inner > 0);
  }
});

test('orbe é visualmente distinto da lâmina', () => {
  const orb = orbShape();
  assert.deepEqual(orb, { halo: 7, core: 4.5, ring: 6.5 });
  assert.ok(orb.halo > orb.ring && orb.ring > orb.core, 'camadas concêntricas ordenadas');
  const blade = bladeShape(26);
  assert.ok(orb.halo < blade.radius, 'o orbe é menor que a lâmina do mesmo espaço');
});
