import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';
import { readHtml, readStyles } from './support/markup.mjs';

const charactersURL = moduleURL('combat/characterCatalog');
const characters = await import(charactersURL);
const configURL = moduleURL('combat/combatConfig');
const { COMBAT_CONFIG } = await import(configURL);

// O catálogo de personagens é importado pelo motor: o carregador resolve a cadeia.
const engineURL = moduleURL('combat/combatEngine');
const { CombatEngine } = await import(engineURL);

const choiceURL = moduleURL('entities/characterChoice');
const choice = await import(choiceURL);
const effectsURL = moduleURL('ui/guEffects');
const effects = await import(effectsURL);

const png = relative => readFileSync(new URL(`../${relative}`, import.meta.url));

/** Motor com um alvo selecionado, como no jogo depois do toque no inimigo. */
function duel(character, { enemyAt = 120 } = {}) {
  const engine = new CombatEngine({ ...COMBAT_CONFIG }, 100, 100, undefined, null,
    () => 0.5, character);
  engine.addEnemy('alvo', enemyAt, 100, 500);
  engine.select('alvo');
  return engine;
}

test('dois personagens jogáveis, ambos Rank 1, com artes próprias e mesma grade', () => {
  assert.deepEqual(characters.PLAYER_CHARACTER_IDS.slice().sort(),
    ['bai-ning-bing', 'fang-yuan']);
  assert.equal(characters.DEFAULT_PLAYER_CHARACTER, 'fang-yuan');
  for (const id of characters.PLAYER_CHARACTER_IDS) {
    const profile = characters.PLAYER_CHARACTERS[id];
    assert.equal(profile.id, id);
    assert.ok(profile.name.length > 3, `${id}: nome`);
    assert.match(profile.title, /Rank 1/, `${id}: começa no Rank 1, como o resto do protótipo`);
    assert.ok(['melee', 'projectile'].includes(profile.kind));
    // Cada personagem usa o próprio prefixo de atlas e tem uma folha de partículas.
    assert.equal(profile.art, id);
    assert.ok(['gu', 'ice'].includes(profile.effects));
    assert.ok(Number.isInteger(profile.accent));
    // As quatro poses existem para os dois, na mesma célula de 64px.
    for (const pose of ['walk', 'cast', 'dash', 'down']) {
      const file = png(`public/assets/characters/${id}-${pose}-64.png`);
      assert.equal(file.subarray(1, 4).toString(), 'PNG');
      assert.equal(file.readUInt32BE(16), 256, `${id}/${pose}: 4 × 64`);
      assert.equal(file.readUInt32BE(20), 256, `${id}/${pose}: 4 × 64`);
    }
    assert.deepEqual([png(`public/assets/characters/${id}-walk-32.png`).readUInt32BE(16),
      png(`public/assets/characters/${id}-walk-32.png`).readUInt32BE(20)], [128, 128]);
  }
  // Entrada inválida nunca vira personagem inexistente.
  assert.equal(characters.playerCharacter('ninguem').id, 'fang-yuan');
  assert.equal(characters.isPlayerCharacterId('bai-ning-bing'), true);
  assert.equal(characters.isPlayerCharacterId(''), false);
});

test('básico à distância é pior em dano e eficiência e melhor em alcance', () => {
  const melee = characters.PLAYER_CHARACTERS['fang-yuan'];
  const ranged = characters.PLAYER_CHARACTERS['bai-ning-bing'];
  assert.equal(melee.kind, 'melee');
  assert.equal(ranged.kind, 'projectile');

  // Dano por segundo do básico no Rank 1 Inicial (ataque 14).
  const attack = 14;
  const dps = profile => attack * profile.combat.damageMultiplier / (profile.basic.cooldownMs / 1000);
  assert.ok(dps(ranged) < dps(melee), `${dps(ranged)} deveria ser menor que ${dps(melee)}`);
  // Eficiência: o disparo abre mais espaço entre golpes.
  assert.ok(ranged.basic.cooldownMs > melee.basic.cooldownMs);
  // Alcance: a vantagem dela.
  assert.ok(ranged.basic.range > melee.basic.range * 2,
    `${ranged.basic.range} deveria ser bem maior que ${melee.basic.range}`);
  // Sobrevivência: paga a distância com vida, defesa e um passo levemente maior.
  assert.ok(ranged.combat.maxHealthMultiplier < melee.combat.maxHealthMultiplier);
  assert.ok(ranged.combat.defenseBonus < melee.combat.defenseBonus);
  assert.ok(ranged.combat.speedMultiplier > melee.combat.speedMultiplier);
  // Nenhum perfil domina os quatro eixos ao mesmo tempo.
  const wins = [
    dps(ranged) > dps(melee),
    ranged.basic.range > melee.basic.range,
    ranged.combat.speedMultiplier > melee.combat.speedMultiplier,
    ranged.basic.cooldownMs < melee.basic.cooldownMs,
  ];
  assert.ok(!wins.every(Boolean), 'um personagem não pode ser melhor em dano, alcance, passo e eficiência');
  assert.ok(wins.filter(Boolean).length < 4);
  // O Fang Yuan não muda de números: o balanceamento dele é a referência.
  assert.equal(melee.basic.range, 62);
  assert.equal(melee.basic.cooldownMs, 600);
  assert.equal(melee.combat.damageMultiplier, 1);
  assert.equal(melee.combat.maxHealthMultiplier, 1);
});

test('básico do Bai Ning Bing voa, respeita alcance, parede e recarga', () => {
  const engine = duel('bai-ning-bing');
  const result = engine.basicAttack(1_000);
  assert.equal(result.ok, true);
  // O dano não é instantâneo: sai um projétil de gelo, sem Gu associado.
  assert.equal(result.events.filter(event => event.type === 'damage').length, 0);
  assert.equal(engine.activeProjectiles.length, 1);
  const shot = engine.activeProjectiles[0];
  assert.equal(shot.style, 'ice');
  assert.equal(shot.guId, null);
  assert.equal(shot.tint, characters.PLAYER_CHARACTERS['bai-ning-bing'].accent);
  assert.equal(shot.speed, 420);
  // 14 de ataque × 9/14 = 9 de dano, reduzido pela defesa 1 do alvo.
  assert.ok(shot.damage >= 9 && shot.damage <= 10, `dano do disparo: ${shot.damage}`);
  // Enquanto voa, o alvo não foi tocado.
  assert.equal(engine.enemies.get('alvo').health, 500);
  engine.tick(1_100, 16);
  assert.equal(engine.enemies.get('alvo').health, 500, 'ainda em voo');
  // Depois de alguns quadros o estilhaço acerta.
  for (let frame = 0; frame < 40 && engine.activeProjectiles.length; frame++) engine.tick(1_100 + frame * 16, 16);
  assert.equal(engine.activeProjectiles.length, 0);
  assert.ok(engine.enemies.get('alvo').health < 500, 'o projétil causou dano');
  // Recarga maior que o corpo a corpo.
  assert.equal(engine.basicAttack(1_200).ok, false);

  // Parede no caminho: o disparo sai, mas para antes do alvo (que está em x = 120).
  const walled = duel('bai-ning-bing');
  walled.basicAttack(1_000);
  for (let frame = 0; frame < 40; frame++) {
    walled.tick(1_100 + frame * 16, 16, (x) => x < 106);
  }
  assert.equal(walled.activeProjectiles.length, 0);
  assert.equal(walled.enemies.get('alvo').health, 500, 'a parede protegeu o alvo');
  // Fora do alcance dela o disparo é recusado.
  const far = duel('bai-ning-bing', { enemyAt: 400 });
  assert.match(far.basicAttack(1_000).reason, /fora do alcance/);
  engine.destroy(); walled.destroy(); far.destroy();
});

test('básico do Fang Yuan continua corpo a corpo e igual ao de antes', () => {
  const engine = duel('fang-yuan');
  const result = engine.basicAttack(1_000);
  assert.equal(result.ok, true);
  assert.equal(result.events[0].type, 'damage');
  assert.equal(result.events[0].amount, 13, 'floor(14 × 100 / 101)');
  assert.equal(engine.activeProjectiles.length, 0);
  assert.equal(engine.basicAttack(1_200).ok, false, 'recarga de 600 ms');
  // O obstáculo bloqueia o golpe: a distância não passa por parede.
  const blocked = duel('fang-yuan');
  assert.match(blocked.basicAttack(1_000, () => false).reason, /Obstáculo/);
  engine.destroy(); blocked.destroy();
});

test('trocar de personagem preserva cultivo, Gu e pedras e reescala a vida', () => {
  const engine = duel('fang-yuan');
  engine.equipment.support = 'stone-skin';
  engine.equipment.support = null;
  const beforeInventory = { ...engine.inventory };
  const beforeEquipment = { ...engine.equipment };
  const beforeAssimilated = [...engine.assimilated];
  engine.hero.health = engine.hero.maxHealth;
  assert.equal(engine.hero.maxHealth, 100);

  assert.equal(engine.setCharacter('bai-ning-bing'), true);
  assert.equal(engine.character.id, 'bai-ning-bing');
  assert.deepEqual(engine.inventory, beforeInventory, 'inventário intacto');
  assert.deepEqual(engine.equipment, beforeEquipment, 'equipamento intacto');
  assert.deepEqual([...engine.assimilated], beforeAssimilated, 'nada assimilado é perdido');
  assert.equal(engine.hero.maxHealth, 85, '15% menos vida');
  assert.equal(engine.hero.health, 85, 'a vida acompanha a proporção');
  assert.equal(engine.defenseAt(0), 1, 'defesa 2 do cultivo − 1 do perfil');
  assert.ok(Math.abs(engine.speedMultiplier(0) - 1.05) < 1e-9, '+5% de passo');
  assert.equal(engine.activeProjectiles.length, 0, 'nada de projétil órfão na troca');

  assert.equal(engine.setCharacter('bai-ning-bing'), false, 'mesmo personagem: nada muda');
  assert.equal(engine.setCharacter('ninguem'), false, 'id inválido é recusado');

  assert.equal(engine.setCharacter('fang-yuan'), true);
  assert.equal(engine.hero.maxHealth, 100, 'volta ao valor de referência');
  assert.equal(engine.defenseAt(0), 2);
  engine.destroy();
});

test('escolha do personagem é sanitizada e não mexe no salvamento de Gu', () => {
  assert.equal(choice.normalizeCharacterChoice('bai-ning-bing'), 'bai-ning-bing');
  assert.equal(choice.normalizeCharacterChoice({ choice: 'bai-ning-bing' }), 'bai-ning-bing');
  assert.equal(choice.normalizeCharacterChoice('ninguem'), 'fang-yuan');
  assert.equal(choice.normalizeCharacterChoice(null), 'fang-yuan');
  assert.equal(choice.normalizeCharacterChoice(42), 'fang-yuan');

  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert.equal(choice.loadCharacterChoice(storage), 'fang-yuan', 'vazio cai no padrão');
  assert.equal(choice.saveCharacterChoice('bai-ning-bing', storage), true);
  assert.equal(choice.loadCharacterChoice(storage), 'bai-ning-bing');
  memory.set(choice.CHARACTER_STORAGE_KEY, '{quebrado');
  assert.equal(choice.loadCharacterChoice(storage), 'fang-yuan', 'save corrompido não derruba o jogo');
  memory.set(choice.CHARACTER_STORAGE_KEY, JSON.stringify({ version: 1, choice: 'ninguem' }));
  assert.equal(choice.loadCharacterChoice(storage), 'fang-yuan', 'id desconhecido é descartado');
  // Chave própria: a escolha não escreve no estado de Gu.
  assert.notEqual(choice.CHARACTER_STORAGE_KEY, 'fang-yuan.gu.v1');
});

test('partículas de gelo têm folha própria, também como máscara recolorível', () => {
  const file = png('public/assets/characters/ice-effects-4x4-48.png');
  assert.equal(file.subarray(1, 4).toString(), 'PNG');
  assert.equal(file.readUInt32BE(16), 192, '4 × 48');
  assert.equal(file.readUInt32BE(20), 192, '4 × 48');
  assert.equal(file[25], 6, 'canal alfa');
  assert.deepEqual(effects.ICE_EFFECT_SHAPES, ['frost', 'shard', 'burst', 'wave']);
  assert.deepEqual(Object.values(effects.ICE_EFFECT_ROW).sort(), [0, 1, 2, 3]);
  for (const shape of effects.ICE_EFFECT_SHAPES) {
    const frames = effects.styleEffectFrames('ice', shape);
    assert.equal(frames.length, 4);
    assert.equal(frames[0], effects.ICE_EFFECT_ROW[shape] * 4);
  }
  // Estilo escolhe a folha; a cor continua vindo do Gu (ou do personagem).
  const cast = effects.effectForStyle('ice', 'moonlight', 'cast');
  assert.equal(cast.texture, 'ice-effects');
  assert.equal(cast.shape, 'shard');
  assert.equal(cast.tint, effects.effectTint('moonlight'), 'mesma cor do catálogo');
  assert.equal(effects.effectForStyle('gu', 'moonlight', 'cast').texture, 'gu-effects');
  // O básico não tem Gu: a forma existe mesmo sem id e a cor é a do personagem.
  assert.equal(effects.effectForStyle('ice', null, 'cast').shape, 'shard');
  assert.equal(effects.effectForStyle('gu', null, 'cast').shape, 'swirl');
  assert.equal(effects.effectForStyle('ice', null, 'cast', 0x9fd8ff).tint, 0x9fd8ff);
  assert.equal(effects.effectForStyle('ice', 'moonlight', 'cast', 0x9fd8ff).tint,
    effects.effectTint('moonlight'), 'com Gu equipado, a cor é a do Gu');
  // A folha publicada é máscara (o script de build a converte): nada de cor na arte.
  const build = readFileSync(new URL('../scripts/build-sprite-atlases.py', import.meta.url), 'utf8');
  assert.match(build, /def mask_into_place\(/);
  assert.match(build, /mask_into_place\(DEST \/ ICE_EFFECTS_ATLAS\)/);
  assert.ok(effects.effectScale('shard') < effects.effectScale('wave'));
});

test('seleção e apresentação estão ligadas no main.ts e na página', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const html = readHtml();
  const css = readStyles();
  assert.ok(main.includes('loadCharacterChoice()'), 'personagem salvo é lido ao criar a cena');
  assert.ok(main.includes('this.combat.setCharacter(id)'), 'troca passa pelo motor');
  assert.ok(main.includes('this.player.setArt(this.combat.character.art)'), 'sprite troca de arte');
  assert.ok(main.includes('this.characterSheet?.setCharacter(id)'), 'ficha acompanha');
  assert.ok(main.includes('saveCharacterChoice(id)'), 'escolha persiste');
  assert.ok(main.includes('effectForStyle(this.combat.character.effects'), 'partículas pelo estilo');
  // Nenhuma regra de combate foi trocada por apresentação.
  assert.ok(main.includes('this.combat.activate(equipped, now, direction, this.isFree)'));
  assert.ok(main.includes('this.combat.dash(now, movementDirection, this.isFree)'));
  // Página: botão de troca e painel com os dois cartões.
  assert.match(html, /id="character-switch"/);
  assert.match(html, /id="character-select"/);
  assert.match(css, /\.character-portrait\[data-character="fang-yuan"\]/);
  assert.match(css, /\.character-portrait\[data-character="bai-ning-bing"\]/);
  assert.match(css, /bai-ning-bing-walk-32\.png/);
});

test('painel de personagem troca de cartão e avisa o jogo uma vez', async () => {
  class FakeElement {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {};
      this.listeners = new Map(); this.hidden = false; this.textContent = ''; this.className = '';
      this.classList = { values: new Set(), toggle: (name, on) => {
        if (on) this.classList.values.add(name); else this.classList.values.delete(name);
      } }; }
    append(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    contains(node) { return node === this || this.children.includes(node); }
    querySelector(selector) { return this.bySelector.get(selector) ?? null; }
  }
  const toggle = new FakeElement('button');
  const root = new FakeElement('aside');
  root.hidden = true;
  const title = new FakeElement();
  const list = new FakeElement();
  root.bySelector = new Map([['#character-select-title', title], ['.character-options', list]]);
  const documentRoot = new FakeElement();
  documentRoot.bySelector = new Map([['#character-switch', toggle], ['#character-select', root]]);
  const previousDocument = globalThis.document;
  globalThis.document = { querySelector: selector => documentRoot.querySelector(selector),
    createElement: tag => new FakeElement(tag), addEventListener() {} };
  try {
    const { CharacterSelect, describeCombat } = await import(moduleURL('ui/characterSelect'));
    const picked = [];
    const select = new CharacterSelect('fang-yuan', id => picked.push(id));
    assert.equal(select.selected, 'fang-yuan');
    assert.equal(toggle.textContent, 'Fang Yuan');
    assert.equal(list.children.length, 2, 'um cartão por personagem');
    assert.equal(select.pick('fang-yuan'), false, 'mesmo personagem não dispara troca');
    assert.deepEqual(picked, []);
    assert.equal(select.pick('bai-ning-bing'), true);
    assert.deepEqual(picked, ['bai-ning-bing']);
    assert.equal(toggle.textContent, 'Bai Ning Bing');
    assert.equal(root.hidden, true, 'escolher fecha o painel');
    // Cartões refletem a escolha atual.
    const active = list.children.filter(card => card.attributes['aria-pressed'] === 'true');
    assert.equal(active.length, 1);
    assert.equal(active[0].dataset.character, 'bai-ning-bing');
    // Texto do cartão não promete mecânica que o motor não faz.
    for (const id of characters.PLAYER_CHARACTER_IDS) {
      const text = describeCombat(characters.PLAYER_CHARACTERS[id]);
      assert.match(text, /vida/);
      assert.match(text, /básico/);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});
