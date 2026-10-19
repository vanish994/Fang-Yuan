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
const npc = moduleURL('entities/npc', { '../agents/agentBrain': moduleURL('agents/agentBrain') });
const mob = moduleURL('combat/mobCatalog');
const world = moduleURL('world/initialWorld', { '../entities/npc': npc, '../combat/mobCatalog': mob });
const area = moduleURL('world/areaGenerator', { './initialWorld': world });
const { INITIAL_WORLD, areaNpcDefinitions } = await import(world);
const { generateArea } = await import(area);
const { canStandAt, canWalkSegment, releaseWallSnag } = await import(moduleURL('world/footprint'));
const { shortestWorldWaypoints } = await import(moduleURL('world/cardinalNavigation'));

test('pé de 14×10: pré-teste com folga desliza em parede sem permitir atravessá-la', () => {
  const free = (x, y) => x >= 0 && y >= 0 && !(x === 3 && y === 4);
  // Corpo na borda direita da parede: arredondamento < 1px não deve impedir
  // movimento tangencial; Arcade ainda faz a colisão física de verdade.
  assert.equal(canStandAt(134.8, 144, 32, free), false);
  assert.equal(canStandAt(134.8, 146, 32, free, 2), true);
  assert.equal(canStandAt(130, 146, 32, free, 2), false);
  assert.equal(canStandAt(NaN, 146, 32, free, 2), false);
});

test('dez NPCs da vila ocupam bairros distintos, pés livres e rotas curtas locais', () => {
  const village = INITIAL_WORLD.vila_gu_yue;
  const generated = generateArea(village);
  const npcs = areaNpcDefinitions(village);
  assert.equal(npcs.length, 10);
  for (const a of npcs) {
    assert.ok(canStandAt(a.x, a.y, 32, generated.isFreeTile), `${a.name} bloqueado`);
    for (const b of npcs) if (a !== b)
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 4 * 32,
        `${a.name} e ${b.name} juntos`);
    for (const stop of a.routine ?? [])
      assert.ok(Math.hypot(a.x - stop.x, a.y - stop.y) <= a.wanderRadius,
        `${a.name} voltaria ao centro`);
  }
  assert.equal(village.mobSpawns.length, 0);
  assert.ok(generated.layers.STRUCTURES[21][17] >= 0, 'ruínas abertas visíveis ao lado da praça');
  assert.ok(generated.layers.STRUCTURES[21][29] >= 0);
});

test('joystick e golpe usam pointers independentes; HUD não esconde o mundo', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('../src/ui/combatHUD.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(hud, /button\.addEventListener\('pointerdown'/);
  assert.match(hud, /event\.detail === 0/);
  assert.match(hud, /event\.pointerId !== this\.steeringPointer/);
  assert.match(main, /this\.combat\.hero\.x = this\.player\.x; this\.combat\.hero\.y = this\.player\.y;/);
  assert.match(main, /this\.player\.move\(stick, true, speed\)/);
  assert.doesNotMatch(main, /this\.canSteer/);
  assert.match(main, /canWalkSegment\(from, to, TILE_SIZE, tileFree\)/);
  assert.doesNotMatch(main, /TEST_ENEMY_OFFSETS|this\.add\.circle\(0, -13/);
  assert.match(html, /\.combat-top \{ top: max\(8px/);
  assert.match(html, /\.map-label \{ display: none; \}/);
});

test('novos pés não ocultam nenhum encontro existente ao carregar as nove áreas', () => {
  for (const definition of Object.values(INITIAL_WORLD)) {
    const generated = generateArea(definition);
    for (const spawn of [...definition.mobSpawns, ...definition.npcSpawns]) {
      assert.ok(canStandAt(spawn.x * 32, spawn.y * 32, 32, generated.isFreeTile),
        `${definition.id}:${spawn.id} deveria aparecer`);
    }
  }
});

test('segundo dedo aciona Lua enquanto primeiro mantém joystick; click não duplica', async () => {
  const stick = moduleURL('ui/cardinalStick');
  const { CombatHUD } = await import(moduleURL('ui/combatHUD', { './cardinalStick': stick }));
  const controls = new Map();
  const element = () => ({
    dataset: {}, listeners: new Map(), captured: new Set(),
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    emit(name, event) { this.listeners.get(name)?.(event); },
    setPointerCapture(id) { this.captured.add(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
  });
  for (const action of ['basic', 'moonlight', 'dash', 'auto', 'respawn']) {
    const button = element(); button.dataset.action = action;
    controls.set(`[data-action="${action}"]`, button);
  }
  controls.set('.combat-joystick', element());
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return { querySelector(selector) { return controls.get(selector) ?? element(); },
        querySelectorAll() { return [...controls.values()].slice(0, 5); },
        remove() {} };
    },
    body: { append() {} },
  };
  try {
    const actions = [];
    const hud = new CombatHUD({}, action => actions.push(action));
    const joystick = controls.get('.combat-joystick');
    const preventDefault = () => {};
    joystick.emit('pointerdown', { pointerId: 1, clientX: 100, clientY: 50, preventDefault });
    assert.equal(hud.direction, 'right');
    const moon = controls.get('[data-action="moonlight"]');
    moon.emit('pointerdown', { pointerId: 2, pointerType: 'touch', preventDefault });
    assert.deepEqual(actions, ['moonlight']);
    assert.equal(hud.direction, 'right');
    moon.emit('click', { detail: 1 }); // navegador sintetizou click após pointerdown
    assert.deepEqual(actions, ['moonlight']);
    joystick.emit('pointerup', { pointerId: 2 });
    assert.equal(hud.direction, 'right');
    joystick.emit('pointerup', { pointerId: 1 });
    assert.equal(hud.direction, null);
    moon.emit('click', { detail: 0 }); // teclado
    assert.deepEqual(actions, ['moonlight', 'moonlight']);
  } finally { globalThis.document = originalDocument; }
});

test('toque junto à parede não escolhe reta que faz o corpo ficar travado', () => {
  // Parece uma rota livre se apenas a linha dos pés (y=99, tile 3) for testada.
  // Mas o corpo começa em y=87 e bateria no tile (2,2) ao andar para a esquerda.
  const tileFree = (x, y) => x >= 0 && y >= 0 && x < 5 && y < 5
    && !(x === 2 && y === 2);
  const from = { x: 112, y: 99 }, to = { x: 48, y: 99 };
  assert.equal(canWalkSegment(from, to, 32, tileFree), false);
  const stand = (x, y) => tileFree(x, y)
    && canStandAt((x + 0.5) * 32, (y + 0.5) * 32, 32, tileFree);
  const steps = (x, y, nx, ny) => Math.abs(x - nx) + Math.abs(y - ny) === 1
    && stand(x, y) && stand(nx, ny);
  const route = shortestWorldWaypoints(from, to, 5, 32, stand, steps,
    'left', false, (a, b) => canWalkSegment(a, b, 32, tileFree));
  assert.ok(route?.length > 2);
  assert.deepEqual(route.at(-1), to);
  let before = from;
  for (const point of route) {
    assert.equal(canWalkSegment(before, point, 32, tileFree), true,
      `colisão escondida no trecho ${JSON.stringify([before, point])}`);
    before = point;
  }
});

test('rotas do centro até os NPCs e saídas da vila mantêm hitbox livre em cada trecho', () => {
  const generated = generateArea(INITIAL_WORLD.vila_gu_yue);
  const free = generated.isFreeTile;
  const centerFree = (x, y) => free(x, y) && canStandAt((x + 0.5) * 32,
    (y + 0.5) * 32, 32, free);
  const step = (x, y, nx, ny) => Math.abs(x - nx) + Math.abs(y - ny) === 1
    && centerFree(x, y) && centerFree(nx, ny);
  const start = { x: 24.5 * 32, y: 24.5 * 32 };
  const destinations = [...INITIAL_WORLD.vila_gu_yue.npcSpawns.map(n => ({
    x: n.x * 32, y: n.y * 32, id: n.id,
  })), { x: 46.5 * 32, y: 24.5 * 32, id: 'portão' }];
  for (const { x, y, id } of destinations) {
    const route = shortestWorldWaypoints(start, { x, y }, 48, 32, centerFree, step,
      'right', false, (a, b) => canWalkSegment(a, b, 32, free));
    assert.ok(route, `${id}: sem rota`);
    assert.deepEqual(route.at(-1), { x, y }, id);
    let previous = start;
    for (const point of route) {
      assert.ok(canWalkSegment(previous, point, 32, free), `${id}: trecho bloqueado`);
      previous = point;
    }
  }
});

test('Arcade: penetração subpixel lateral é liberada sem atravessar a parede', () => {
  const free = (x, y) => x >= 0 && y >= 0 && !(x === 3 && y === 4);
  const snag = { x: 134.8, y: 144 };
  assert.equal(canStandAt(snag.x, snag.y, 32, free), false);
  const released = releaseWallSnag(snag.x, snag.y, 'down', 32, free);
  assert.deepEqual(released, { x: 135.05, y: 144 });
  assert.equal(canStandAt(released.x, released.y, 32, free), true);
  // Se a largura de todo o corredor estiver bloqueada, não move nem um pixel.
  const blocked = () => false;
  assert.deepEqual(releaseWallSnag(100, 100, 'down', 32, blocked), { x: 100, y: 100 });
});
