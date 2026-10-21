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
const { NpcBrain, TEST_NPCS, npcLine, npcLines, hintApplies } = await import(npcURL);
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
      image() { return { setOrigin() { return this; }, setScale() { return this; } }; },
      sprite(_x, _y, key, frame) {
        const sprite = { key, frame, played: [], anims: { play(key) { sprite.played.push(key); } },
          setOrigin() { return this; }, setScale(scale) { this.scale = scale; return this; },
          setTint(tint) { this.tint = tint; return this; },
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

test('falas de teste têm base na novela, sem placeholder e com ciclo por conversa', () => {
  const all = [];
  for (const npc of TEST_NPCS) {
    const lines = npcLines(npc);
    assert.ok(lines.length >= 3, `${npc.name} precisa de pelo menos três falas`);
    assert.equal(lines[0], npc.dialogue);
    assert.deepEqual(lines, [...new Set(lines)], `${npc.name} repete fala`);
    for (const line of lines) {
      assert.ok(line.trim().length >= 20, `${npc.name} tem fala curta demais: ${line}`);
      // O aviso de combate tem largura limitada; falas longas cobrem a tela no celular.
      assert.ok(line.length <= 120, `${npc.name} tem fala longa demais (${line.length}): ${line}`);
      assert.doesNotMatch(line, /Fala de teste/i);
      all.push(line);
    }
  }
  assert.equal(all.length, 31);
  assert.deepEqual(all, [...new Set(all)], 'duas falas iguais no elenco');
  // Termos que ancoram as falas nos fatos da novela (ver docs/DIALOGOS-NPC.md).
  assert.ok(all.some(line => /orquídeas?-da-lua|orquídea-da-lua/i.test(line)));
  assert.ok(all.some(line => /pedras? primárias?/i.test(line)));
  assert.ok(all.some(line => /cerimônia do despertar/i.test(line)));
  assert.ok(all.some(line => /Rank [234]/.test(line)));
});

test('cada conversa avança uma fala e volta ao início no fim da lista', () => {
  const definition = TEST_NPCS[0];
  const lines = npcLines(definition);
  assert.equal(npcLine(definition, 1), lines[0]);
  assert.equal(npcLine(definition, 2), lines[1]);
  assert.equal(npcLine(definition, lines.length + 1), lines[0]);
  assert.equal(npcLine(definition, 0), lines[0]);
  assert.equal(npcLine(definition, Number.NaN), lines[0]);
  const solo = { ...definition, dialogues: undefined };
  assert.equal(npcLine(solo, 5), definition.dialogue, 'NPC com uma fala só não quebra o ciclo');
  const brain = new NpcBrain(definition);
  assert.equal(brain.conversations, 0);
  assert.equal(brain.line, lines[0], 'antes de qualquer toque mostra a fala inicial');
  brain.interact(10);
  assert.equal(brain.conversations, 1);
  assert.equal(brain.line, lines[0], 'a primeira conversa usa a fala de apresentação');
  brain.interact(20);
  assert.equal(brain.line, lines[1]);
  assert.equal(brain.agent.memory.lastInteractionAt, 20);
  brain.interact(30);
  brain.interact(40);
  assert.equal(brain.line, lines[0], 'a quarta conversa do NPC de três falas volta ao início');
});

test('ganchos de mundo têm condição válida e fala dentro do limite do HUD', () => {
  const lines = TEST_NPCS.flatMap(npc => npcLines(npc));
  const hinted = TEST_NPCS.flatMap(npc => npc.hints ?? []);
  assert.ok(hinted.length >= 10, 'o elenco precisa reagir ao progresso do jogador');
  for (const npc of TEST_NPCS) {
    for (const hint of npc.hints ?? []) {
      const conditions = [hint.minRank, hint.minStones, hint.minEquippedGu].filter(v => v !== undefined);
      assert.ok(conditions.length >= 1, `${npc.name} tem gancho sem condição`);
      assert.ok(hint.line.trim().length >= 20 && hint.line.length <= 120,
        `${npc.name} tem gancho fora do tamanho: ${hint.line}`);
      assert.doesNotMatch(hint.line, /Fala de teste/i);
      assert.ok(!lines.includes(hint.line), `${npc.name} repete um gancho como fala comum`);
    }
    const multiple = (npc.hints ?? []).length > 1;
    if (multiple) {
      const ranks = npc.hints.map(hint => hint.minRank ?? 0);
      assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a),
        `${npc.name} deve declarar o gancho de Rank mais alto primeiro`);
    }
    for (const hint of npc.hints ?? []) {
      if (hint.minRank !== undefined) assert.ok(hint.minRank >= 2 && hint.minRank <= 9);
      if (hint.minStones !== undefined) assert.ok(Number.isSafeInteger(hint.minStones) && hint.minStones > 0);
      if (hint.minEquippedGu !== undefined) assert.ok(hint.minEquippedGu >= 1 && hint.minEquippedGu <= 4);
    }
  }
  const all = [...lines, ...hinted.map(hint => hint.line)];
  assert.deepEqual(all, [...new Set(all)], 'fala repetida entre base e ganchos');
});

test('condição do gancho compara Rank, pedras e Gu equipadas', () => {
  const context = { rank: 2, stage: 'Inicial', spiritStones: 50, equippedGu: 2 };
  assert.equal(hintApplies({ line: 'x', minRank: 2 }, context), true);
  assert.equal(hintApplies({ line: 'x', minRank: 3 }, context), false);
  assert.equal(hintApplies({ line: 'x', minStones: 50 }, context), true);
  assert.equal(hintApplies({ line: 'x', minStones: 51 }, context), false);
  assert.equal(hintApplies({ line: 'x', minEquippedGu: 2 }, context), true);
  assert.equal(hintApplies({ line: 'x', minEquippedGu: 3 }, context), false);
  assert.equal(hintApplies({ line: 'x', minRank: 2, minStones: 100 }, context), false);
  assert.equal(hintApplies({ line: 'x' }, context), true);
});

test('gancho de Rank é dito uma vez e não interrompe o rodízio das falas comuns', () => {
  const chen = TEST_NPCS.find(npc => npc.id === 'npc-old-chen');
  const lines = npcLines(chen);
  const context = rank => ({ rank, stage: 'Inicial', spiritStones: 0, equippedGu: 1 });
  const brain = new NpcBrain(chen);
  assert.deepEqual([...brain.hinted], [], 'nada comentado antes da primeira conversa');
  brain.interact(10, context(1));
  assert.equal(brain.line, lines[0]);
  brain.interact(20, context(1));
  assert.equal(brain.line, lines[1]);
  assert.deepEqual([...brain.hinted], [], 'Rank 1 não ativa gancho de Rank');
  brain.interact(30, context(2));
  assert.match(brain.line, /Já está no Rank 2/);
  assert.deepEqual([...brain.hinted], [1]);
  brain.interact(40, context(2));
  assert.equal(brain.line, lines[2], 'sem gancho novo, o rodízio continua');
  brain.interact(50, context(3));
  assert.match(brain.line, /Rank 3 no meu portão/);
  assert.deepEqual([...brain.hinted], [1, 0], 'cada gancho aparece uma vez por sessão');
  brain.interact(60, context(3));
  assert.equal(brain.line, lines[0], 'depois dos ganchos a conversa volta ao início');
  brain.interact(70);
  assert.equal(brain.line, lines[1], 'brain sem contexto ignora ganchos e segue o rodízio');
  assert.equal(chen.hints.length, 2, 'conversar não altera os dados do NPC');
});

test('gancho de Gu equipadas exige a condição completa do vendedor', () => {
  const vendor = TEST_NPCS.find(npc => npc.id === 'npc-jiang-ya');
  const brain = new NpcBrain(vendor);
  const context = equippedGu => ({ rank: 1, stage: 'Inicial', spiritStones: 0, equippedGu });
  brain.interact(10, context(2));
  assert.equal(brain.line, vendor.dialogue);
  brain.interact(20, context(3));
  assert.match(brain.line, /Três Gu na mão/);
  brain.interact(30, context(4));
  assert.equal(brain.line, npcLines(vendor)[1], 'o mesmo gancho não se repete');
});

test('dez NPCs na clareira com identidades e cérebro independente do Phaser', () => {
  assert.equal(TEST_NPCS.length, 10);
  assert.deepEqual(TEST_NPCS.slice(0, 4).map(n => n.name),
    ['Gu Yue Mei', 'Lin Shan', 'Jiang Ya', 'Velho Chen']);
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
  assert.deepEqual(loaded[0], ['npc-static-4dir', 'assets/npcs/npc-static-4dir-64.png',
    { frameWidth: 64, frameHeight: 64 }]);
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
  const names = texts.filter(text => TEST_NPCS.some(npc => npc.name === text));
  assert.deepEqual(names.slice(0, 4), ['Gu Yue Mei', 'Lin Shan', 'Jiang Ya', 'Velho Chen']);
  let stopped = false;
  sprites[0].handler({}, 0, 0, { stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.match(messages[0], /Gu Yue Mei.*vila parece tranquila/);
  assert.equal(records[0].brain.agent.memory.lastInteractionAt, 123);
  sprites[0].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[1], /já conversou/);
  assert.match(messages[1], /orquídeas-da-lua/, 'a segunda conversa usa a segunda fala');
  sprites[0].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[2], /já conversou/);
  assert.match(messages[2], /onda de lobos/);
  sprites[0].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[3], /vila parece tranquila/, 'quarta conversa volta ao começo');
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

test('toque informa o Rank do jogador e o NPC comenta uma vez antes de voltar às falas comuns', () => {
  const { scene, layer, sprites } = fakeScene();
  const messages = [];
  let context = { rank: 1, stage: 'Inicial', spiritStones: 0, equippedGu: 1 };
  createTestNpcViews(scene, layer, isFree, text => messages.push(text), undefined, () => context);
  const chen = TEST_NPCS.findIndex(npc => npc.id === 'npc-old-chen');
  sprites[chen].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[0], /Não se afaste demais da vila/);
  context = { ...context, rank: 2, stage: 'Médio' };
  sprites[chen].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[1], /já conversou/);
  assert.match(messages[1], /Já está no Rank 2/);
  sprites[chen].handler({}, 0, 0, { stopPropagation() {} });
  assert.match(messages[2], /A cada três anos os lobos/);
  assert.doesNotMatch(messages[2], /Rank 2/);
});

test('vendedor tem banca identificada, fala de mercador e nenhuma promessa de venda', () => {
  const vendors = TEST_NPCS.filter(npc => npc.stall);
  assert.deepEqual(vendors.map(npc => npc.name), ['Jiang Ya', 'Tia Hua']);
  assert.ok(vendors.every(npc => npc.role === 'merchant'));
  assert.deepEqual(vendors.map(npc => npc.stall), ['banca de Gu', 'banca de comida']);
  const jiang = vendors[0];
  assert.match(jiang.dialogue, /Banca do clã/);
  assert.match(npcLines(jiang).join(' '), /pétala/i, 'o vendedor precisa citar o que vende');
  assert.match(npcLines(jiang).join(' '), /preço/i, 'a fala atribui o preço ao clã, não ao NPC');
  // Nenhum texto de banca promete compra, desconto ou item jogável.
  for (const npc of vendors) {
    for (const line of [...npcLines(npc), ...(npc.hints ?? []).map(hint => hint.line)]) {
      assert.doesNotMatch(line, /desconto|promoção|compre agora|grátis|R\$/i, line);
    }
  }
  const { scene, layer, texts } = fakeScene();
  createTestNpcViews(scene, layer, isFree, () => {});
  assert.ok(texts.includes('banca de Gu') && texts.includes('banca de comida'),
    'a banca precisa aparecer no mapa');
  assert.equal(texts.filter(text => text.startsWith('banca')).length, 2);
});

test('toque no vendedor pode abrir a banca sem gastar a fala comum', () => {
  const { scene, layer, sprites } = fakeScene();
  const messages = [];
  const seen = [];
  createTestNpcViews(scene, layer, isFree, text => messages.push(text), undefined, undefined,
    definition => {
      seen.push(definition.id);
      return definition.id === 'npc-jiang-ya';
    });
  const vendorIndex = TEST_NPCS.findIndex(npc => npc.id === 'npc-jiang-ya');
  sprites[vendorIndex].handler({}, 0, 0, { stopPropagation() {} });
  assert.deepEqual(seen, ['npc-jiang-ya']);
  assert.deepEqual(messages, [], 'a banca substitui a fala do vendedor');
  const mei = TEST_NPCS.findIndex(npc => npc.id === 'npc-gu-yue-mei');
  sprites[mei].handler({}, 0, 0, { stopPropagation() {} });
  assert.deepEqual(seen, ['npc-jiang-ya', 'npc-gu-yue-mei']);
  assert.match(messages[0], /vila parece tranquila/, 'os demais NPCs seguem falando');
});

test('atlas específico tem 10 NPCs em ordem de manifesto, poses estáticas e direções corretas', () => {
  const png = readFileSync(new URL('../public/assets/npcs/npc-static-4dir-32.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 320);
  assert.equal(png[25], 6);
  assert.deepEqual(Object.values(NPC_ROWS), Array.from({ length: 10 }, (_, i) => i));
  assert.deepEqual(new Set(TEST_NPCS.map(n => n.id)), new Set(Object.keys(NPC_ROWS)));
  assert.equal(npcFrame('npc-jiang-ya', 'right'), 7);
  assert.equal(npcFrame('npc-lin-shan', 'up'), 14);
  assert.throws(() => npcFrame('inexistente', 'down'), /NPC sem sprite/);
  const { scene, layer, sprites, views } = fakeScene(true);
  const records = createTestNpcViews(scene, layer, isFree, () => {});
  assert.equal(records.length, 10);
  assert.equal(sprites[1].frame, 12); // Lin Shan: linha 3, baixo
  assert.ok(records.every(record => record.uniqueArt));
  assert.ok(sprites.every(sprite => sprite.scale === 0.4));
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
  assert.match(main, /equippedGu: Object\.values\(this\.combat\.equipment\)/,
    'o toque precisa informar o progresso atual do jogador');
});
