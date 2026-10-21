import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readStyles } from './support/markup.mjs';

function moduleURL(path, imports = {}) {
  let js = ts.transpileModule(readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, url] of Object.entries(imports)) js = js.replace(`from '${from}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const agentURL = moduleURL('agents/agentBrain');
const npcURL = moduleURL('entities/npc', { '../agents/agentBrain': agentURL });
const mobURL = moduleURL('combat/mobCatalog');
const worldURL = moduleURL('world/initialWorld', {
  '../entities/npc': npcURL, '../combat/mobCatalog': mobURL,
  './mobPlacement': moduleURL('world/mobPlacement'),
});
const configURL = moduleURL('combat/combatConfig');
const generatorURL = moduleURL('world/areaGenerator', {
  './initialWorld': worldURL, '../combat/combatConfig': configURL,
});
const { INITIAL_WORLD } = await import(worldURL);
const { generateArea } = await import(generatorURL);
const { buildMinimapSnapshot, minimapPosition, MINIMAP_CELL } =
  await import(moduleURL('ui/minimapModel'));
const cell = (map, x, y) => map.cells[y * map.size + x];

test('minimapa usa a área ativa, terreno real e somente suas saídas', () => {
  const village = buildMinimapSnapshot(generateArea(INITIAL_WORLD.vila_gu_yue));
  assert.equal(village.size, 48);
  assert.equal(village.cells.length, 48 * 48);
  assert.equal(cell(village, 47, 24), MINIMAP_CELL.exit);
  assert.notEqual(cell(village, 0, 24), MINIMAP_CELL.exit);
  assert.equal(cell(village, 10, 13), MINIMAP_CELL.stone, 'parede existente');
  assert.ok(village.cells.includes(MINIMAP_CELL.trail));
  assert.ok(village.cells.includes(MINIMAP_CELL.trees));
  const exterior = buildMinimapSnapshot(generateArea(INITIAL_WORLD.floresta_exterior));
  assert.equal(cell(exterior, 0, 24), MINIMAP_CELL.exit);
  assert.equal(cell(exterior, 47, 24), MINIMAP_CELL.exit);
  assert.equal(cell(exterior, 36, 36), MINIMAP_CELL.water);
  assert.notDeepEqual(village.cells, exterior.cells);
});

test('marcador acompanha o pixel do jogador em cada área e nunca sai do quadro', () => {
  assert.deepEqual(minimapPosition(24.5 * 32, 24.5 * 32, 48), { x: 49, y: 49 });
  assert.deepEqual(minimapPosition(80, 24.5 * 32, 48), { x: 5, y: 49 });
  assert.deepEqual(minimapPosition(-100, 99999, 48), { x: 2, y: 93 });
  assert.deepEqual(minimapPosition(NaN, Infinity, 48), { x: 2, y: 2 });
});

test('painel mobile não intercepta toques, fica abaixo de Menu e troca de área com a cena', () => {
  const css = readStyles();
  const scene = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/ui/minimap.ts', import.meta.url), 'utf8');
  assert.match(css, /\.combat-minimap\s*\{[^}]*top:[^}]*right:[^}]*pointer-events: none/s);
  assert.match(css, /\.combat-minimap canvas\s*\{[^}]*image-rendering: pixelated/s);
  assert.match(scene, /this\.minimap = new MinimapView\(this\.combatHUD\.root\)/);
  assert.match(scene, /this\.minimap\?\.setArea\(this\.currentArea\)/);
  assert.match(scene, /this\.minimap\?\.update\(this\.player\.x, this\.player\.y\)/);
  assert.match(scene, /this\.minimap\?\.destroy\(\)/);
  assert.match(view, /position\.x === this\.lastX && position\.y === this\.lastY/);
});
