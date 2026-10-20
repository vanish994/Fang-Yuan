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
const placement = moduleURL('world/mobPlacement');
const worldURL = moduleURL('world/initialWorld', {
  '../entities/npc': npc, '../combat/mobCatalog': mob, './mobPlacement': placement,
});
const { INITIAL_WORLD, AREA_TILES, areaNpcDefinitions, areaMobDefinitions, mobSpawnsForArea,
  OPPOSITE } = await import(worldURL);
const combatConfigURL = moduleURL('combat/combatConfig');
const { generateArea, dirtFrame, WORLD_LAYERS } = await import(moduleURL('world/areaGenerator', {
  './initialWorld': worldURL, '../combat/combatConfig': combatConfigURL,
}));
const { TEST_NPCS } = await import(npc);
const { TEST_MOBS } = await import(mob);
const { canStandAt } = await import(moduleURL('world/footprint'));

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
  // O algoritmo opera sobre a grade de área 48×48; o quadrado está no centro desta máscara.
  assert.equal(dirtFrame(mask, 4, 4), 10, 'interior: terra lisa');
  // Encostas com três lados de terra usam as peças de faixa fina medidas no atlas
  // (72 = grama ao norte, 84 = ao sul, 76 = a oeste, 77 = a leste).
  assert.equal(dirtFrame(mask, 4, 2), 72);
  assert.equal(dirtFrame(mask, 4, 6), 84);
  assert.equal(dirtFrame(mask, 2, 4), 76);
  assert.equal(dirtFrame(mask, 6, 4), 77);
  // Pontas de trilha (uma única vizinha de terra) usam a meia célula oposta.
  const line = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let y = 2; y <= 6; y++) line[y][4] = true;
  assert.equal(dirtFrame(line, 4, 5), 50, 'corredor em pé: grama dos lados');
  assert.equal(dirtFrame(line, 4, 2), 25, 'ponta de cima: grama ao norte');
  assert.equal(dirtFrame(line, 4, 6), 37, 'ponta de baixo: grama ao sul');
  // Quinas arredondadas (grama nos dois lados livres) e mancha isolada.
  assert.equal(dirtFrame(mask, 2, 2), 43, 'quina noroeste: grama a norte e oeste');
  assert.equal(dirtFrame(mask, 6, 6), 30, 'quina sudeste: grama a sul e leste');
  const dot = Array.from({ length: 9 }, () => Array(9).fill(false));
  dot[4][4] = true;
  assert.equal(dirtFrame(dot, 4, 4), 44, 'mancha isolada');
});

test('a cena carrega só a área ativa e não substitui NPCs, bosses ou atributos de combate', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /this\.loadArea\('vila_gu_yue'/);
  assert.match(main, /this\.currentArea = generateArea\(INITIAL_WORLD\[id\]\)/);
  // A cena usa os spawns efetivos (autorais + extras), não só a lista fixa.
  assert.match(main, /mobSpawnsForArea\(this\.currentArea\.definition, this\.isFree\)/);
  assert.match(main, /areaNpcDefinitions\(this\.currentArea\.definition\)/);
  assert.match(main, /this\.combat\.clearAreaEnemies\(\)/);
  assert.match(main, /this\.currentArea\.isFreeTile/);
});

test('densidade: extras nascem em chão livre, separados e nunca duplicam chefe', () => {
  // Curva pedida: cerca de 2× a quantidade original, com a Região Rochosa
  // deixando de ter um único encontro.
  const expected = {
    vila_gu_yue: 0, floresta_exterior: 12, floresta_perigosa: 8, regiao_rochosa: 6,
    cavernas: 8, covil_lobo: 4, covil_javali: 5, ninho_serpente: 4, santuario_besta: 4,
  };
  const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  let total = 0;
  // O motor guarda recompensa por id de instância: o id precisa ser único no
  // mundo inteiro, não só dentro da área.
  const globalIds = new Set();
  for (const definition of Object.values(INITIAL_WORLD)) {
    const generated = generateArea(definition);
    const isFree = (x, y) => canStandAt(x, y, 32, generated.isFreeTile);
    const spawns = mobSpawnsForArea(definition, isFree);
    assert.equal(spawns.length, expected[definition.id],
      `${definition.id}: ${spawns.length} mobs`);
    total += spawns.length;
    assert.equal(new Set(spawns.map(s => s.id)).size, spawns.length, `${definition.id}: id repetido`);
    const bosses = spawns.filter(s => TEST_MOBS.find(m => m.id === (s.speciesId ?? s.id))?.tier === 'boss');
    assert.equal(bosses.length,
      definition.mobSpawns.filter(s => TEST_MOBS.find(m => m.id === (s.speciesId ?? s.id))?.tier === 'boss').length,
      `${definition.id}: chefe não pode ser duplicado`);
    for (const spawn of spawns) {
      assert.ok(!globalIds.has(spawn.id), `id global repetido: ${spawn.id}`);
      globalIds.add(spawn.id);
    }
    const authored = new Set(definition.mobSpawns.map(spawn => spawn.id));
    for (const spawn of spawns) {
      assert.ok(isFree(spawn.x * 32, spawn.y * 32), `${definition.id}:${spawn.id} bloqueado`);
      // Só as extras precisam respeitar a entrada; as posições autorais (a
      // arena do chefe fica no centro) são decisão de layout já existente.
      if (!authored.has(spawn.id)) {
        assert.ok(Math.hypot(spawn.x * 32 - 24 * 32, spawn.y * 32 - 24 * 32) > 64,
          `${definition.id}:${spawn.id} em cima da entrada`);
      }
    }
    for (let i = 0; i < spawns.length; i += 1) {
      for (let j = i + 1; j < spawns.length; j += 1) {
        assert.ok(chebyshev(spawns[i], spawns[j]) >= 2,
          `${definition.id}: ${spawns[i].id} e ${spawns[j].id} no mesmo tile`);
      }
    }
  }
  // 30 posições autorais (eram 23; entraram 7 guardas de covil) + 21 extras.
  // A vila continua sem mobs.
  assert.equal(total, 51);
  assert.equal(INITIAL_WORLD.vila_gu_yue.mobSpawns.length, 0);
});
