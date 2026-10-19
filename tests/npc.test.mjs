import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleURL(path, imports = {}) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, url] of Object.entries(imports)) js = js.replace(`from '${from}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const agentURL = moduleURL('agents/agentBrain');
const npcURL = moduleURL('entities/npc', { '../agents/agentBrain': agentURL });
const { NpcBrain, TEST_NPCS } = await import(npcURL);
const npcSpritesURL = moduleURL('entities/npcSprites');
const { NPC_ROWS, npcFrame } = await import(npcSpritesURL);
const { preloadNpcSprites, registerNpcAnimations, createTestNpcViews, updateTestNpcViews } =
  await import(moduleURL('entities/npcView', { './npc': npcURL, './npcSprites': npcSpritesURL }));
const { isWalkableTile, TILE_SIZE } = await import(moduleURL('world/qingMaoGround'));
const isFree = (x, y) => [-7, 7].every(dx => [-7, 0].every(dy =>
  isWalkableTile(Math.floor((x + dx) / TILE_SIZE), Math.floor((y + dy) / TILE_SIZE))));

function fakeScene(uniqueArt = false) {
  const sprites = [], views = [], texts = [], loaded = [];
  const scene = {
    time: { now: 123 },
    textures: { exists(key) { return uniqueArt && key === 'npc-static-4dir'; } },
    load: { spritesheet(...args) { loaded.push(args); }, image(...args) { loaded.push(args); } },
    anims: { keys: new Set(), exists(key) { return this.keys.has(key); },
      generateFrameNumbers(key, range) { return [key, range]; },
      create({ key }) { this.keys.add(key); } },
    add: {
      image() { return { setOrigin() { return this; } }; },
      sprite(_x, _y, key, frame) {
        const sprite = { key, frame, played: [], anims: { play(key) { sprite.played.push(key); } },
          setOrigin() { return this; }, setTint(tint) { this.tint = tint; return this; },
          setFrame(frame) { this.frame = frame; return this; },
          setInteractive() { return this; }, on(_event, handler) { this.handler = handler; return this; } };
        sprites.push(sprite);
        return sprite;
      },
      text(_x, _y, value) { texts.push(value); return { setOrigin() { return this; } }; },
      container(x, y, children) {
        const view = { x, y, children, data: {},
          setName(name) { this.name = name; return this; },
          setDepth(depth) { this.depth = depth; return this; },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
          setData(key, value) { this.data[key] = value; return this; } };
        views.push(view);
        return view;
      },
    },
  };
  const layer = { items: [], add(view) { this.items.push(view); } };
  return { scene, layer, sprites, views, texts, loaded };
}

test('dez NPCs na clareira com identidades e cérebro independente do Phaser', () => {
  assert.equal(TEST_NPCS.length, 10);
  assert.deepEqual(TEST_NPCS.slice(0, 4).map(n => n.name),
    ['Gu Yue Mei', 'Lin Shan', 'Zhao He', 'Velho Chen']);
  assert.ok(TEST_NPCS.every(n => isFree(n.x, n.y)));
  const first = new NpcBrain(TEST_NPCS[0]);
  const second = new NpcBrain(TEST_NPCS[0]);
  assert.equal(first.move('right', 10, isFree), true);
  assert.deepEqual(second.position, { x: TEST_NPCS[0].x, y: TEST_NPCS[0].y });
  assert.equal(TEST_NPCS[0].x, 22 * 32);
  const snapshot = first.position; snapshot.x = 999;
  assert.notEqual(first.position.x, 999);
});

test('os quatro NPCs iniciais ficam visíveis em paisagem mobile', () => {
  for (const [width, height] of [[568, 320], [844, 390]]) {
    for (const npc of TEST_NPCS.slice(0, 4)) {
      const x = width / 2 + (npc.x - 24.5 * TILE_SIZE) * 2;
      const y = height / 2 + (npc.y - 24.5 * TILE_SIZE - 16) * 2;
      assert.ok(x >= 32 && x <= width - 32 && y >= 32 && y <= height - 32,
        `${npc.name} fora da tela ${width}×${height}`);
    }
  }
});

test('o raio conta a distância desde a origem; bloqueios e alertas não atravessam mata', () => {
  const definition = { ...TEST_NPCS[0], wanderRadius: 24 };
  const brain = new NpcBrain(definition);
  assert.deepEqual(brain.decide(0, () => 0.99), { state: 'wander', direction: 'right' });
  assert.equal(brain.move('right', 10, () => true), true);
  assert.equal(brain.move('right', 10, () => true), true);
  assert.equal(brain.move('right', 10, () => true), false);
  assert.deepEqual(brain.position, { x: definition.x + 20, y: definition.y });
  assert.equal(brain.decide(50).direction, null);
  assert.equal(brain.move('left', 5, () => false), false);
  assert.equal(brain.move('left', 5, () => true), true);
  assert.equal(brain.decide(60, () => 0.99, { x: definition.x + 15, y: definition.y }).state, 'alert');
});

test('rota local de NPC segue home em ciclos sem alterar papel, alerta ou diálogo', () => {
  const home = TEST_NPCS[0];
  const brain = new NpcBrain({ ...home, faction: 'A definir',
    routine: [{ x: home.x, y: home.y }, { x: home.x + 32, y: home.y }] });
  assert.equal(brain.decide(0).direction, null);
  assert.deepEqual(brain.decide(20_000), { direction: 'right', state: 'wander' });
  assert.equal(brain.move('right', 32, () => true), true);
  assert.equal(brain.decide(20_050).direction, null);
  assert.equal(brain.decide(40_000).direction, 'left');
  assert.equal(brain.decide(40_001, Math.random, { x: home.x + 35, y: home.y }).state, 'alert');
  assert.equal(brain.definition.faction, 'A definir');
});

test('sprites Mixel preservados com 9 quadros idle, 4 walk e sombra 32px', () => {
  const { scene, loaded } = fakeScene();
  preloadNpcSprites(scene);
  registerNpcAnimations(scene);
  assert.equal(loaded.length, 10);
  assert.equal(scene.anims.keys.size, 8);
  assert.deepEqual(loaded[0], ['npc-static-4dir', 'assets/npcs/npc-static-4dir-32.png',
    { frameWidth: 32, frameHeight: 32 }]);
  for (const [key, path, config] of loaded.slice(1, 9)) {
    assert.match(key, /^npc-(idle|walk)-(down|left|right|up)$/);
    const file = readFileSync(new URL(`../public/${path}`, import.meta.url));
    assert.equal(file.readUInt32BE(16), key.includes('idle') ? 288 : 128);
    assert.equal(file.readUInt32BE(20), 33);
    assert.equal(config.frameWidth, 32);
    assert.equal(config.frameHeight, 33);
  }
  const shadow = readFileSync(new URL('../public/assets/npcs/MainC_Shadow.png', import.meta.url));
  assert.equal(shadow.readUInt32BE(16), 32);
  assert.equal(shadow.readUInt32BE(20), 32);
});

test('sprites e nomes no Y-sort: toque mostra fala, registra memória e não move o jogador', () => {
  const { scene, layer, sprites, views, texts } = fakeScene();
  const messages = [];
  const records = createTestNpcViews(scene, layer, isFree, text => messages.push(text));
  assert.equal(records.length, 10);
  assert.equal(layer.items.length, 10);
  assert.deepEqual(texts.filter((_, index) => index % 2 === 1).slice(0, 4),
    ['ALDEÃ', 'CULTIVADOR', 'MERCADOR', 'GUARDA']);
  let stopped = false;
  sprites[0].handler({}, 0, 0, { stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.match(messages[0], /Gu Yue Mei.*vila parece tranquila/);
  assert.equal(records[0].brain.agent.memory.lastInteractionAt, 123);
  sprites[0].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[1], /já conversou/);
  updateTestNpcViews(records, 0, 50, isFree, () => 0.99);
  assert.equal(views[0].x, TEST_NPCS[0].x + 0.9);
  assert.equal(views[0].depth, views[0].y);
  assert.equal(views[0].data.moving, true);
  assert.match(sprites[0].played.at(-1), /walk-right/);
  records[0].brain.stop();
  updateTestNpcViews(records, 50, 50, isFree, () => 0.99);
  assert.equal(views[0].data.moving, false);
  assert.match(sprites[0].played.at(-1), /idle-right/);
  updateTestNpcViews(records, 60, 50, isFree, () => 0.99,
    () => ({ x: TEST_NPCS[0].x, y: TEST_NPCS[0].y }));
  assert.equal(views[0].data.alert, true);
});

test('atlas específico tem 10 NPCs em ordem de manifesto, poses estáticas e direções corretas', () => {
  const png = readFileSync(new URL('../public/assets/npcs/npc-static-4dir-32.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 320);
  assert.equal(png[25], 6);
  assert.deepEqual(Object.values(NPC_ROWS), Array.from({ length: 10 }, (_, i) => i));
  assert.deepEqual(new Set(TEST_NPCS.map(n => n.id)), new Set(Object.keys(NPC_ROWS)));
  assert.equal(npcFrame('npc-zhao-he', 'right'), 7);
  assert.equal(npcFrame('npc-lin-shan', 'up'), 14);
  assert.throws(() => npcFrame('inexistente', 'down'), /NPC sem sprite/);
  const { scene, layer, sprites, views } = fakeScene(true);
  const records = createTestNpcViews(scene, layer, isFree, () => {});
  assert.equal(records.length, 10);
  assert.equal(sprites[1].frame, 12); // Lin Shan: linha 3, baixo
  assert.ok(records.every(record => record.uniqueArt));
  updateTestNpcViews(records, 0, 50, isFree, () => 0.99);
  assert.equal(views[0].data.moving, true);
  assert.equal(sprites[0].frame, npcFrame('npc-gu-yue-mei', 'right'));
  assert.deepEqual(sprites[0].played, [], 'poses fornecidas não são animações de caminhada');
});

test('spawn bloqueado é ignorado e a cena cria, anima e atualiza NPCs', () => {
  const { scene, layer } = fakeScene();
  const records = createTestNpcViews(scene, layer, (x) => x !== TEST_NPCS[0].x, () => {});
  assert.equal(records.length, 9);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /preloadNpcSprites\(this\)/);
  assert.match(main, /registerNpcAnimations\(this\)/);
  assert.match(main, /this\.npcViews = createTestNpcViews\(this, this\.worldObjects, this\.isFree,/);
  assert.match(main, /updateTestNpcViews\(this\.npcViews, time, delta, this\.isFree,/);
});
