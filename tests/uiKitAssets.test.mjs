import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readHtml } from './support/markup.mjs';

const root = new URL('../', import.meta.url);
const skin = readFileSync(new URL('src/styles/ui-kit.css', root), 'utf8');
const html = readHtml();

test('toda peça citada pela pele existe em public/assets/ui', () => {
  const names = [...skin.matchAll(/url\('\/assets\/ui\/([a-z0-9-]+\.png)'\)/g)].map(m => m[1]);
  assert.ok(names.length >= 20, `esperava o kit inteiro, achei ${names.length} peças`);
  for (const name of new Set(names)) {
    assert.ok(existsSync(new URL(`public/assets/ui/${name}`, root)), `${name} não existe`);
  }
});

test('a pele é ligada depois de main.css e não rouba interação nem área de toque', () => {
  const links = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map(m => m[1]);
  assert.deepEqual(links, ['/src/styles/main.css', '/src/styles/ui-kit.css']);
  // Só aparência: nada de pointer-events, display de [hidden] ou áreas de toque.
  assert.doesNotMatch(skin, /pointer-events\s*:/);
  assert.doesNotMatch(skin, /\[hidden\]/);
  assert.doesNotMatch(skin, /min-height\s*:\s*\d/);
  // A pele não pode desfazer o foco visível herdado de main.css.
  assert.doesNotMatch(skin, /outline\s*:\s*(none|0)/);
});

test('barras usam trilho + preenchimento branco recolorido em CSS', () => {
  const fill = readFileSync(new URL('public/assets/ui/bar-fill.png', root));
  assert.equal(fill.readUInt32BE(16), 443);
  assert.equal(fill.readUInt32BE(20), 51);
  const track = readFileSync(new URL('public/assets/ui/bar-track.png', root));
  assert.equal(track.readUInt32BE(16), 442);
  assert.match(skin, /background-blend-mode:\s*multiply/);
  assert.match(skin, /--ui-bar-health/);
  assert.match(skin, /--ui-bar-essence/);
});

test('peças estruturais do kit estão na pele', () => {
  // O kit original tem rótulos pintados (HEALTH, INVENTORY, MAP, QUIT): esses
  // recortes não são publicados, porque o jogo é PT-BR e o texto é DOM.
  for (const name of ['panel-9slice', 'header-3slice', 'frame-portrait', 'bar-fill',
    'bar-track', 'btn-close-4x88', 'gu-icons-8x8-64', 'joystick-base']) {
    assert.match(skin, new RegExp(name));
  }
  assert.doesNotMatch(skin, /texto\.png|label\.png/i);
});
