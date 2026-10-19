import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleURL(path, imports = {}) {
  let js = ts.transpileModule(readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, url] of Object.entries(imports)) js = js.replace(`from '${from}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const agent = moduleURL('agents/agentBrain');
const npc = moduleURL('entities/npc', { '../agents/agentBrain': agent });
const mob = moduleURL('combat/mobCatalog');
const worldURL = moduleURL('world/initialWorld', {
  '../entities/npc': npc, '../combat/mobCatalog': mob,
});
const { INITIAL_WORLD, AREA_TILES, areaNpcDefinitions, areaMobDefinitions, OPPOSITE } = await import(worldURL);
const combatConfigURL = moduleURL('combat/combatConfig');
const { TEST_ENEMY_OFFSETS } = await import(combatConfigURL);
const { generateArea, dirtFrame, WORLD_LAYERS } = await import(moduleURL('world/areaGenerator', {
  './initialWorld': worldURL, '../combat/combatConfig': combatConfigURL,
}));
const { TEST_NPCS } = await import(npc);
const { TEST_MOBS } = await import(mob);

function connected(area, start, goal) {
  const encode = (p) => `${p.x},${p.y}`;
  const pending = [start], visited = new Set([encode(start)]);
  while (pending.length) {
    const p = pending.shift();
    if (p.x === goal.x && p.y === goal.y) return true;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!area.isFreeTile(q.x, q.y) || visited.has(encode(q))) continue;
      visited.add(encode(q)); pending.push(q);
    }
  }
  return false;
}

test('nove áreas: cada saída tem retorno, cada spawn é único, alcançável e corresponde ao catálogo', () => {
  const areas = Object.values(INITIAL_WORLD);
  assert.equal(areas.length, 9);
  const npcIds = areas.flatMap(a => a.npcSpawns.map(s => s.id));
  const mobIds = areas.flatMap(a => a.mobSpawns.map(s => s.id));
  assert.deepEqual(new Set(npcIds), new Set(TEST_NPCS.map(n => n.id)));
  assert.deepEqual(new Set(areas.flatMap(a => a.mobSpawns.map(s => s.speciesId ?? s.id))),
    new Set(TEST_MOBS.map(m => m.id)));
  assert.equal(new Set(npcIds).size, npcIds.length);
  assert.equal(new Set(mobIds).size, mobIds.length);
  assert.equal(areas.filter(a => a.mobSpawns.some(s => TEST_MOBS.find(m => m.id === s.id)?.tier === 'boss')).length, 4);
  assert.equal(INITIAL_WORLD.covil_lobo.mobSpawns.filter(s => s.speciesId === 'mob-grey-wolf').length, 2);
  const exterior = generateArea(INITIAL_WORLD.floresta_exterior);
  for (const [dx, dy] of TEST_ENEMY_OFFSETS) {
    const x = 24.5 * 32 + dx, y = 24.5 * 32 + dy;
    for (const sx of [-7, 7]) for (const sy of [-7, 0])
      assert.ok(exterior.isFreeTile(Math.floor((x + sx) / 32), Math.floor((y + sy) / 32)),
        'os seis alvos antigos têm spawns livres');
  }
  for (const definition of areas) {
    assert.deepEqual(definition.chunks, { width: 3, height: 3 });
    assert.equal(areaNpcDefinitions(definition).length, definition.npcSpawns.length);
    assert.equal(areaMobDefinitions(definition).length, definition.mobSpawns.length);
    assert.ok(areaMobDefinitions(definition).every(m => m.spriteId in
      Object.fromEntries(TEST_MOBS.map(s => [s.id, true]))));
    const generated = generateArea(definition);
    assert.deepEqual(Object.keys(generated.layers), WORLD_LAYERS);
    assert.equal(generated.collision.length, AREA_TILES);
    for (const spawn of [...definition.npcSpawns, ...definition.mobSpawns]) {
      const tile = { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
      assert.equal(generated.isFreeTile(tile.x, tile.y), true, `${definition.id}:${spawn.id} bloqueado`);
      for (const dx of [-7, 7]) for (const dy of [-7, 0])
        assert.ok(generated.isFreeTile(Math.floor((spawn.x * 32 + dx) / 32),
          Math.floor((spawn.y * 32 + dy) / 32)), `${definition.id}:${spawn.id} hitbox bloqueada`);
      assert.ok(connected(generated, { x: 24, y: 24 }, tile), `${definition.id}:${spawn.id} inacessível`);
    }
    for (const [side, other] of Object.entries(definition.exits)) {
      assert.equal(INITIAL_WORLD[other].exits[OPPOSITE[side]], definition.id);
      const tile = side === 'north' ? { x: 24, y: 1 } : side === 'south' ? { x: 24, y: 46 }
        : side === 'west' ? { x: 1, y: 24 } : { x: 46, y: 24 };
      assert.ok(connected(generated, { x: 24, y: 24 }, tile), `${definition.id} → ${other} bloqueado`);
    }
    assert.deepEqual(generateArea(definition).layers, generated.layers, 'seed deve reproduzir o mapa');
  }
});

test('autotiling escolhe formas reais do atlas; variações não decidem a topologia', () => {
  const mask = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) mask[y][x] = true;
  // O algoritmo opera sobre a grade de área 48×48; o quadrado está no canto interno desta máscara.
  assert.equal(dirtFrame(mask, 4, 4), 10);
  assert.equal(dirtFrame(mask, 4, 2), 25);
  assert.equal(dirtFrame(mask, 4, 6), 37);
  assert.equal(dirtFrame(mask, 2, 4), 24);
  assert.equal(dirtFrame(mask, 6, 4), 27);
});

test('a cena carrega só a área ativa e não substitui NPCs, bosses ou atributos de combate', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /this\.loadArea\('vila_gu_yue'/);
  assert.match(main, /this\.currentArea = generateArea\(INITIAL_WORLD\[id\]\)/);
  assert.match(main, /areaMobDefinitions\(this\.currentArea\.definition\)/);
  assert.match(main, /areaNpcDefinitions\(this\.currentArea\.definition\)/);
  assert.match(main, /this\.combat\.clearAreaEnemies\(\)/);
  assert.match(main, /this\.currentArea\.isFreeTile/);
});
