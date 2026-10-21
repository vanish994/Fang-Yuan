import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { readStyles } from './support/markup.mjs';

const file = relative => readFileSync(new URL(`../${relative}`, import.meta.url));
const size = relative => {
  const png = file(relative);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png[25], 6, `${relative}: falta alfa`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

test('fontes 1920px preservadas e atlas 2× com todos os quadros de cada manifesto', () => {
  for (const source of [
    'fang-yuan-walk-4dir-4frames-master.png', 'bai-ning-bing-walk-4dir-4frames-master.png',
    'bai-ning-bing-cast-4dir-4frames-master.png', 'npc-static-4dir-master.png',
    'mob-static-4dir-master.png', 'boss-static-4dir-master.png',
  ]) {
    const path = `art/source/${source}`;
    assert.deepEqual(size(path), [1920, 1920]);
    assert.ok(statSync(new URL(`../${path}`, import.meta.url)).size > 1_000_000);
  }
  for (const [path, dims] of [
    ['characters/fang-yuan-walk-64.png', [256, 256]],
    ['characters/bai-ning-bing-walk-64.png', [256, 256]],
    ['characters/ice-effects-4x4-48.png', [192, 192]],
    ['npcs/npc-static-4dir-64.png', [256, 640]],
    ['mobs/mob-static-4dir-64.png', [256, 960]],
    ['bosses/boss-static-4dir-96.png', [384, 384]],
  ]) assert.deepEqual(size(`public/assets/${path}`), dims);
});

test('texturas altas mantêm tamanhos lógicos e hitbox sem alterar IA ou regras', () => {
  const main = file('src/main.ts').toString();
  const npc = file('src/entities/npcView.ts').toString();
  const player = file('src/entities/PlayerCharacter.ts').toString();
  const css = readStyles();
  assert.match(main, /\.png`[\s\S]*?frameWidth: 64, frameHeight: 64/);
  assert.match(main, /mob-static-4dir-64\.png'[\s\S]*?frameWidth: 64, frameHeight: 64/);
  assert.match(main, /boss-static-4dir-96\.png'[\s\S]*?frameWidth: 96, frameHeight: 96/);
  assert.match(main, /setScale\(boss \? 0\.45 : 0\.425\)/);
  assert.match(npc, /npc-static-4dir-64\.png'[\s\S]*?frameWidth: 64, frameHeight: 64/);
  assert.match(npc, /sprite\.setScale\(0\.4\)/);
  assert.match(player, /setScale\(0\.5\)/);
  assert.match(player, /setSize\(28, 20\)\.setOffset\(18, 40\)/);
  assert.match(css, /\.sheet-portrait::before/);
  assert.match(css, /256px 256px no-repeat/);
  assert.equal(64 * 0.5, 32, 'personagem mantém 32px no mundo (Fang Yuan e Bai Ning Bing)');
  assert.equal(28 * 0.5, 14, 'largura do corpo Arcade preservada');
  assert.equal(20 * 0.5, 10, 'altura do corpo Arcade preservada');
  assert.equal(18 * 0.5, 9, 'offset horizontal preservado');
  assert.equal(40 * 0.5, 20, 'offset vertical preservado');
  assert.equal(64 * 0.4, 32 * 0.8, 'NPC mantém tamanho visual anterior');
  assert.equal(64 * 0.425, 32 * 0.85, 'mob mantém tamanho visual anterior');
  assert.equal(96 * 0.45, 48 * 0.9, 'boss mantém tamanho visual anterior');
});
