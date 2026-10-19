import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entities/characterProfile.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { FANG_YUAN_PROFILE, INITIAL_CULTIVATION, UNCONFIGURED_CHARACTER, characterSheetState } =
  await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('ficha básica usa a identidade de Fang Yuan e acompanha movimento/orientação reais', () => {
  assert.equal(FANG_YUAN_PROFILE.name, 'Fang Yuan');
  assert.match(FANG_YUAN_PROFILE.area, /Montanha Qing Mao/);
  assert.deepEqual(characterSheetState('down', false), {
    ...FANG_YUAN_PROFILE, activity: 'Parado', direction: 'Sul',
  });
  for (const [direction, label] of [
    ['up', 'Norte'], ['left', 'Oeste'], ['right', 'Leste'], ['down', 'Sul'],
  ]) {
    assert.deepEqual(characterSheetState(direction, true), {
      ...FANG_YUAN_PROFILE, activity: 'Caminhando', direction: label,
    });
  }
});

test('sem XP: Fang Yuan inicia no Rank 1 Inicial com 0 recursos', () => {
  assert.deepEqual(INITIAL_CULTIVATION,
    { rank: 1, stage: 'Inicial', spiritStones: 0, materials: {} });
  for (const key of ['aptitude', 'opening', 'openingCapacity']) {
    assert.equal(UNCONFIGURED_CHARACTER[key], null);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\bXP\b|\bnível\b/i);
  assert.match(html, /Pedras espirituais/);
});

test('pedras espirituais são uma moeda única; fontes futuras são drop direto e troca de drops', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const balance = readFileSync(new URL('../BALANCEAMENTO.md', import.meta.url), 'utf8');
  assert.match(html, /Pedras espirituais/);
  assert.doesNotMatch(html, /Pedras primordiais/);
  assert.match(balance, /drop direto de inimigos/);
  assert.match(balance, /troca dos itens dropados pelos inimigos por pedras/);
  assert.match(balance, /taxas de drop, itens aceitos nem valores de troca definidos/);
});

test('GDD atualizado separa regras de cultivo aprovadas e balanceamento provisório', () => {
  const gdd = readFileSync(new URL('../docs/GDD-ATUALIZADO.md', import.meta.url), 'utf8');
  assert.match(gdd, /Não há XP nem nível numérico/);
  assert.match(gdd, /9 Ranks/);
  assert.match(gdd, /configuração provisória centralizada/);
  assert.match(gdd, /spritesheet do Mar Primordial foi enviado pelo usuário/);
  assert.doesNotMatch(gdd, /progressão principal.*baseada em \*\*XP/);
});

test('ficha mobile fica fechada por padrão e tem controles acessíveis', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="character-toggle"[^>]*aria-controls="character-sheet"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="character-sheet"[^>]*hidden/);
  assert.match(html, /id="character-close"[^>]*aria-label="Fechar ficha"/);
  assert.match(html, /id="advance-action"[^>]*disabled[^>]*aria-describedby="advance-reason"/);
  assert.match(html, /id="advance-feedback"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /env\(safe-area-inset-top\)/);
  assert.match(html, /class="advance-action"[^>]*disabled/);
  assert.match(html, /\.advance-action\s*\{[^}]*min-height:\s*48px/s);
  assert.match(html, /max-height:\s*calc\(100dvh/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/);
});
