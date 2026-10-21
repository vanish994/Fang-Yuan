import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleURL } from './support/tsModule.mjs';
import { readHtml, readStyles } from './support/markup.mjs';


const profile = moduleURL('entities/characterProfile');
const rules = moduleURL('entities/cultivation');
const balance = moduleURL('entities/cultivationBalance');
const session = moduleURL('entities/characterCultivation', {
  './characterProfile': profile, './cultivation': rules, './cultivationBalance': balance,
});
const intent = moduleURL('ui/advanceIntent');
const sea = moduleURL('ui/primordialSea');
const combatConfig = moduleURL('combat/combatConfig');
const agentBrain = moduleURL('agents/agentBrain');
const combatEngine = moduleURL('combat/combatEngine', {
  './combatConfig': combatConfig, '../agents/agentBrain': agentBrain,
});
const sheet = moduleURL('ui/characterSheet', {
  '../entities/characterProfile': profile,
  '../entities/cultivationBalance': balance,
  '../entities/characterCultivation': session,
  './advanceIntent': intent,
  './primordialSea': sea,
  '../combat/combatConfig': combatConfig,
});
const { CharacterSheet } = await import(sheet);
const { CharacterCultivation, CULTIVATION_STORAGE_KEY } = await import(session);
const { CombatEngine } = await import(combatEngine);

class FakeElement {
  textContent = '';
  hidden = false;
  disabled = false;
  style = {};
  attributes = {};
  listeners = new Map();
  children = [];
  value = '';
  scrollTop = 0;
  tabIndex = 0;
  addEventListener(event, callback) { this.listeners.set(event, callback); }
  removeEventListener(event) { this.listeners.delete(event); }
  appendChild(element) { this.children.push(element); return element; }
  replaceChildren() { this.children = []; }
  remove() {}
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() {}
  click() { if (!this.disabled) this.listeners.get('click')?.(); }
  change() { this.listeners.get('change')?.(); }
}

test('ficha touch: requisitos, confirmação, resultado e proteção contra toques duplicados', () => {
  const html = readHtml();
  const css = readStyles();
  assert.match(css, /max-height:\s*calc\(100dvh/);
  assert.match(css, /\.advance-action\s*\{[^}]*min-height:\s*48px/s);
  assert.match(html, /role="tablist" aria-label="Menu do personagem"/);
  assert.match(html, /role="tabpanel" aria-labelledby="tab-inventory"[^>]*hidden/);
  for (const slot of ['attack', 'passive', 'movement', 'support']) {
    assert.match(html, new RegExp(`<select id="gu-${slot}"`));
  }
  // recortes de painel podem vir do markup ou da folha de estilo
  const page = `${html}\n${css}`;
  for (const asset of ['panel-9slice.png', 'header-3slice.png', 'frame-portrait.png',
    'btn-close-4x88.png', 'chip-9slice.png', 'card-gu-9slice.png']) {
    assert.match(page, new RegExp(asset.replace('.', '\\.')));
  }
  assert.doesNotMatch(html, /class="combat-gear"/);
  const ids = [...html.matchAll(/id="([a-z-]+)"/g)].map((match) => match[1]);
  const elements = new Map(ids.map((id) => [id, new FakeElement()]));
  elements.get('character-sheet').hidden = true;
  const documentListeners = new Map();
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements.get(id) ?? null,
    createElement: () => new FakeElement(),
    addEventListener: (event, cb) => documentListeners.set(event, cb),
    removeEventListener: (event) => documentListeners.delete(event),
  };
  try {
    const memory = new Map([[CULTIVATION_STORAGE_KEY, JSON.stringify({ version: 1,
      state: { rank: 1, stage: 'Inicial', spiritStones: 120, materials: {} } })]]);
    const storage = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    };
    const cultivation = new CharacterCultivation(storage);
    const combat = new CombatEngine();
    combat.essence = 84;
    let now = 1000;
    const view = new CharacterSheet(cultivation, combat, () => now);
    const toggle = elements.get('character-toggle');
    const action = elements.get('advance-action');
    toggle.click();
    assert.equal(elements.get('character-sheet').hidden, false);
    assert.equal(elements.get('character-sea').style.backgroundPositionX, '-896px');
    assert.match(elements.get('character-sea').attributes['aria-label'], /84 de 100 de essência primordial/);
    combat.essence = 19;
    view.update('down', false);
    assert.equal(elements.get('character-sea').style.backgroundPositionX, '-224px');
    assert.equal(elements.get('character-sea-amount').textContent, '19 / 100 de essência primordial');
    assert.equal(elements.get('advance-stones').textContent, '20 pedras');
    assert.equal(elements.get('character-rank').textContent, '1');
    assert.equal(elements.get('character-stage').textContent, 'Inicial');
    const inventoryTab = elements.get('tab-inventory');
    const advanceTab = elements.get('tab-advance');
    inventoryTab.click();
    assert.equal(elements.get('panel-advance').hidden, true);
    assert.equal(elements.get('panel-inventory').hidden, false);
    assert.equal(inventoryTab.attributes['aria-selected'], 'true');
    inventoryTab.listeners.get('keydown')?.({ key: 'ArrowLeft', currentTarget: inventoryTab,
      preventDefault() {} });
    assert.equal(elements.get('panel-advance').hidden, false);
    advanceTab.listeners.get('keydown')?.({ key: 'ArrowRight', currentTarget: advanceTab,
      preventDefault() {} });
    assert.equal(elements.get('panel-inventory').hidden, false);
    assert.equal(elements.get('gu-slot-count').textContent, '1 / 4');
    // O seletor lista somente Gu possuídos do slot, com a opção vazia primeiro.
    const attackOptions = elements.get('gu-attack').children.map(option => option.value);
    assert.equal(attackOptions[0], '');
    assert.ok(attackOptions.includes('moonlight'));
    assert.ok(attackOptions.includes('bone-spear'));
    assert.match(elements.get('gu-effect-attack').textContent, /Ativo/);
    // A coleção mostra todos os Gu publicados e documenta os slots pendentes.
    const shelf = elements.get('gu-collection').children;
    const cards = shelf.filter(child => child.attributes['data-gu']);
    assert.equal(cards.length, 26); // 24 Gu Rank 1 + 2 resultados de refino Rank 2
    assert.equal(cards.filter(card => card.attributes['data-gu'] === 'moonlight').length, 1);
    assert.ok(shelf.some(child => /Pendente no slot de movimento/.test(child.textContent)));
    // A coleção é reconstruída a cada troca: sempre consultar os cartões atuais.
    const cardFor = id => elements.get('gu-collection').children
      .find(child => child.attributes['data-gu'] === id);
    const actionButton = (id, index) => cardFor(id).children.at(-1).children[index];
    // Camadas de atributos: base, equipados, temporários e permanentes têm fonte única no motor.
    assert.match(elements.get('stat-base').textContent, /Vida 100 · Ataque 14/);
    assert.match(elements.get('stat-equipped').textContent, /defesa/);
    assert.match(elements.get('stat-temporary').textContent, /Nenhum efeito/);
    actionButton('stone-skin', 0).click(); // equipar pelo cartão
    assert.equal(combat.equipment.passive, 'stone-skin');
    assert.equal(elements.get('gu-icon-passive').attributes['data-gu'], 'stone-skin');
    actionButton('stone-skin', 0).click(); // remover
    assert.equal(combat.equipment.passive, null);
    const passive = elements.get('gu-passive');
    passive.value = 'stone-skin'; passive.change();
    assert.equal(combat.equipment.passive, 'stone-skin');
    assert.equal(combat.defense, 6);
    const support = elements.get('gu-support');
    support.value = 'liquor-worm'; support.change();
    assert.equal(combat.equipment.support, 'liquor-worm');
    assert.equal(combat.essenceRegen, 3);
    const movement = elements.get('gu-movement');
    movement.value = 'whirlwind'; movement.change();
    assert.equal(combat.equipment.movement, 'whirlwind');
    assert.equal(elements.get('gu-slot-count').textContent, '4 / 4');
    combat.combatUntil = now + 5000;
    view.update('down', false);
    assert.equal(passive.disabled, true);
    assert.match(elements.get('gear-lock').textContent, /Em combate/);
    passive.value = ''; passive.change(); // motor recusa mesmo se um evento manipulado ignorar disabled.
    assert.equal(passive.value, 'stone-skin');
    assert.equal(combat.defense, 6);
    assert.match(elements.get('gu-feedback').textContent, /bloqueada/);
    now += 5001;
    view.update('down', false);
    assert.equal(passive.disabled, false);
    passive.value = ''; passive.change();
    assert.equal(combat.defense, 2);
    assert.equal(elements.get('gu-slot-count').textContent, '3 / 4');
    advanceTab.click();
    assert.equal(elements.get('panel-inventory').hidden, true);
    assert.equal(elements.get('panel-advance').hidden, false);
    action.click();
    assert.equal(action.textContent, 'Confirmar gasto');
    assert.equal(cultivation.state.spiritStones, 120);
    inventoryTab.click(); // trocar de aba cancela confirmação anterior.
    advanceTab.click();
    assert.equal(action.textContent, 'Avançar de estágio');
    assert.equal(cultivation.state.spiritStones, 120);
    action.click();
    assert.equal(action.textContent, 'Confirmar gasto');
    action.click();
    assert.equal(cultivation.state.stage, 'Médio');
    assert.equal(cultivation.state.spiritStones, 100);
    assert.equal(action.textContent, 'Revisar próximo avanço');
    action.click(); // um terceiro clique não compra Médio→Superior
    assert.equal(cultivation.state.stage, 'Médio');
    assert.equal(cultivation.state.spiritStones, 100);
    assert.equal(elements.get('advance-stones').textContent, '35 pedras');
    assert.deepEqual(new CharacterCultivation(storage).state, cultivation.state);
    documentListeners.get('keydown')?.({ key: 'Escape' });
    assert.equal(elements.get('character-sheet').hidden, true);
    view.destroy();
  } finally {
    globalThis.document = previousDocument;
  }
});
