import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const asset = new URL('../public/assets/ui/mar-primordial-11x128.png', import.meta.url);

test('sprite fornecido do Mar Primordial tem 11 quadros reais de 128 px', () => {
  const png = readFileSync(asset);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 11 * 128);
  assert.equal(png.readUInt32BE(20), 128);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /mar-primordial-11x128\.png/);
  const advancement = html.match(/<section class="sheet-section" aria-label="Próximo avanço">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(advancement, 'menu de avanço deve existir');
  assert.match(advancement, /id="character-sea"[^>]*role="img"/);
  assert.match(advancement, /Mar Primordial/);
  assert.match(advancement, /Abertura · Dantian/);
  const [beforeAdvance, afterAdvance] = html.split('<section class="sheet-section" aria-label="Próximo avanço">');
  assert.doesNotMatch(beforeAdvance, /id="character-sea"/);
  assert.doesNotMatch(afterAdvance.split('</section>')[1], /id="character-sea"/);
  const hud = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  assert.match(hud, /<span>Vida<\/span><progress id="combat-health"/);
  assert.match(hud, /<span>Essência primordial<\/span><progress id="combat-essence"/);
  assert.doesNotMatch(hud, /combat-sea|sea-sprite|primordialSeaOffset/);
  assert.doesNotMatch(html, /Essência primeva/);
});
