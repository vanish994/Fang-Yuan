import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleURL } from './support/tsModule.mjs';
import { readHtml, readStyles } from './support/markup.mjs';
import { fakeDocument, FakeElement } from './support/fakeDom.mjs';

const profile = moduleURL('entities/characterProfile');
const rules = moduleURL('entities/cultivation');
const balance = moduleURL('entities/cultivationBalance');
const session = moduleURL('entities/characterCultivation', {
  './characterProfile': profile, './cultivation': rules, './cultivationBalance': balance,
});
const { CharacterCultivation, CULTIVATION_STORAGE_KEY } = await import(session);
const { CombatEngine } = await import(moduleURL('combat/combatEngine'));
const { GU_CATALOG } = await import(moduleURL('combat/guCatalog'));
const { GuStateStore, GU_STATE_STORAGE_KEY, MAX_GU_STACK } = await import(moduleURL('combat/guState'));
const vendor = await import(moduleURL('combat/vendor'));
const { VENDOR_STOCK, VENDOR_BUYBACK, buyGu, sellMaterial, sellTotal, buybackPrice,
  vendorOffer } = vendor;
const { VendorPanel } = await import(moduleURL('ui/vendorPanel'));

function storageWith(seed = {}) {
  const data = new Map(Object.entries(seed));
  const storage = {
    data,
    failing: false,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      if (storage.failing) throw new Error('disco cheio');
      data.set(key, value);
    },
  };
  return storage;
}

function cultivationWith({ stones = 1000, materials = {} } = {}) {
  const storage = storageWith({
    [CULTIVATION_STORAGE_KEY]: JSON.stringify({ version: 1,
      state: { rank: 1, stage: 'Inicial', spiritStones: stones, materials } }),
  });
  const cultivation = new CharacterCultivation(storage);
  return { cultivation, storage };
}

function engineWith(storage = storageWith()) {
  const store = new GuStateStore(storage);
  return { engine: new CombatEngine(undefined, 100, 100, undefined, store), storage };
}

// ── Catálogo da banca ──────────────────────────────────────────────────────
test('estoque da banca é curto, Rank 1, equipável e com o preço de referência', () => {
  assert.ok(VENDOR_STOCK.length >= 4 && VENDOR_STOCK.length <= 8, 'estoque simples');
  assert.equal(new Set(VENDOR_STOCK.map(offer => offer.guId)).size, VENDOR_STOCK.length);
  for (const offer of VENDOR_STOCK) {
    const gu = GU_CATALOG[offer.guId];
    assert.ok(gu, `Gu inexistente na banca: ${offer.guId}`);
    assert.equal(gu.rank, 1, `${gu.label} não é Rank 1`);
    assert.ok(gu.categories.includes('equippable'), `${gu.label} não é equipável`);
    assert.ok(!gu.assimilation, `${gu.label} é assimilável e não deve ser vendida`);
    assert.ok(!gu.categories.includes('consumable'), `${gu.label} é consumível`);
    assert.equal(offer.price, gu.price, 'a banca usa o preço de referência do catálogo');
    assert.ok(Number.isSafeInteger(offer.price) && offer.price > 0);
  }
  const slots = new Set(VENDOR_STOCK.map(offer => GU_CATALOG[offer.guId].slot));
  assert.deepEqual([...slots].sort(), ['attack', 'movement', 'passive', 'support']);
  assert.equal(vendorOffer('moonlight'), null, 'a Gu inicial do jogador não está à venda');
});

test('tabela de compra cobre só materiais de ruptura com preço crescente por Rank', () => {
  assert.deepEqual(VENDOR_BUYBACK.map(price => price.materialId),
    ['ruptura-rank-1', 'ruptura-rank-2', 'ruptura-rank-3', 'ruptura-rank-4']);
  for (const [index, price] of VENDOR_BUYBACK.entries()) {
    assert.equal(price.materialId, `ruptura-rank-${index + 1}`);
    assert.ok(Number.isSafeInteger(price.unitPrice) && price.unitPrice > 0);
    if (index > 0) assert.ok(price.unitPrice > VENDOR_BUYBACK[index - 1].unitPrice);
  }
  assert.equal(buybackPrice('ruptura-rank-9'), null);
  assert.equal(buybackPrice('pedra-aleatoria'), null);
  assert.equal(sellTotal('ruptura-rank-1', 3), 24);
  assert.equal(sellTotal('ruptura-rank-1', 0), null);
  assert.equal(sellTotal('ruptura-rank-1', 1.5), null);
});

// ── Compra ─────────────────────────────────────────────────────────────────
test('compra desconta o preço exato e entrega uma Gu persistida', () => {
  const { cultivation, storage } = cultivationWith({ stones: 2000 });
  const { engine, storage: guStorage } = engineWith();
  // O inventário de teste já traz uma cópia de cada Gu Rank 1; a banca soma pilha.
  const before = engine.inventoryCount('star-arrow');
  const result = buyGu(cultivation, engine, 'star-arrow');
  assert.equal(result.ok, true);
  assert.match(result.message, /Flecha Estelar|Star Arrow/);
  assert.equal(cultivation.state.spiritStones, 2000 - GU_CATALOG['star-arrow'].price);
  assert.equal(engine.inventoryCount('star-arrow'), before + 1);
  const savedCultivation = JSON.parse(storage.data.get(CULTIVATION_STORAGE_KEY));
  assert.equal(savedCultivation.state.spiritStones, 1350);
  const savedGu = JSON.parse(guStorage.data.get(GU_STATE_STORAGE_KEY));
  assert.equal(savedGu.inventory['star-arrow'], before + 1);
  // Comprar de novo soma outra unidade; nada é equipado automaticamente.
  assert.equal(buyGu(cultivation, engine, 'star-arrow').ok, true);
  assert.equal(engine.inventoryCount('star-arrow'), before + 2);
  assert.equal(cultivation.state.spiritStones, 700);
  assert.equal(engine.equipment.attack, 'moonlight');
});

test('compra recusa Gu fora do estoque, saldo insuficiente e pilha cheia sem gastar pedras', () => {
  const { cultivation } = cultivationWith({ stones: 100 });
  const { engine } = engineWith();
  const poor = buyGu(cultivation, engine, 'star-arrow');
  const before = engine.inventoryCount('star-arrow');
  assert.equal(poor.ok, false);
  assert.match(poor.message, /Faltam 550 pedras/);
  assert.equal(cultivation.state.spiritStones, 100);
  assert.equal(engine.inventoryCount('star-arrow'), before);

  assert.match(buyGu(cultivation, engine, 'não-existe').message, /não está na banca/);
  assert.match(buyGu(cultivation, engine, 'moonlight').message, /não está na banca/);
  assert.equal(cultivation.state.spiritStones, 100);

  const rich = cultivationWith({ stones: 100_000 }).cultivation;
  const full = { inventoryCount: () => MAX_GU_STACK, grantGu: () => ({ ok: true }) };
  const blocked = buyGu(rich, full, 'star-arrow');
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /Inventário cheio/);
  assert.equal(rich.state.spiritStones, 100_000, 'pilha cheia não cobra');
});

test('se o inventário falhar ao guardar, o pagamento volta e nada é cobrado', () => {
  const { cultivation } = cultivationWith({ stones: 1000 });
  const failing = { inventoryCount: () => 0, grantGu: () => ({ ok: false, reason: 'save falhou' }) };
  const result = buyGu(cultivation, failing, 'star-arrow');
  assert.equal(result.ok, false);
  assert.match(result.message, /save falhou/);
  assert.equal(cultivation.state.spiritStones, 1000, 'pedras devolvidas no rollback');
});

test('se o rollback também falhar, a banca avisa em vez de sumir com o erro', () => {
  let charged = false;
  const wallet = {
    state: { spiritStones: 1000, materials: {} },
    spendStones: () => { charged = true; return true; },
    receiveStones: () => { throw new Error('gravação indisponível'); },
    tradeMaterial: () => false,
  };
  const failing = { inventoryCount: () => 0, grantGu: () => ({ ok: false }) };
  const result = buyGu(wallet, failing, 'star-arrow');
  assert.equal(charged, true);
  assert.equal(result.ok, false);
  assert.match(result.message, /recarregue a página/);
});

test('falha de gravação do cultivo aborta a compra sem entregar Gu', () => {
  const { cultivation, storage } = cultivationWith({ stones: 1000 });
  const { engine } = engineWith();
  storage.failing = true;
  const before = engine.inventoryCount('star-arrow');
  const result = buyGu(cultivation, engine, 'star-arrow');
  assert.equal(result.ok, false);
  assert.match(result.message, /não foi possível pagar/i);
  assert.equal(cultivation.state.spiritStones, 1000);
  assert.equal(engine.inventoryCount('star-arrow'), before);
});

// ── Venda ──────────────────────────────────────────────────────────────────
test('vender material soma pedras e remove o material na mesma gravação', () => {
  const { cultivation, storage } = cultivationWith({ stones: 10, materials: { 'ruptura-rank-1': 3 } });
  const result = sellMaterial(cultivation, 'ruptura-rank-1', 2);
  assert.equal(result.ok, true);
  assert.match(result.message, /2× Material de ruptura · Rank 1 vendido por 16 pedras/);
  assert.equal(cultivation.state.spiritStones, 26);
  assert.equal(cultivation.state.materials['ruptura-rank-1'], 1);
  const saved = JSON.parse(storage.data.get(CULTIVATION_STORAGE_KEY));
  assert.equal(saved.state.spiritStones, 26);
  assert.equal(saved.state.materials['ruptura-rank-1'], 1);

  // Vender a última unidade remove a chave em vez de deixar zero no save.
  assert.equal(sellMaterial(cultivation, 'ruptura-rank-1', 1).ok, true);
  assert.equal(cultivation.state.materials['ruptura-rank-1'], undefined);
  const last = JSON.parse(storage.data.get(CULTIVATION_STORAGE_KEY));
  assert.equal(last.state.materials['ruptura-rank-1'], undefined);
  assert.equal(cultivation.state.spiritStones, 34);
});

test('venda recusa material desconhecido, quantidade inválida e falta de estoque', () => {
  const { cultivation } = cultivationWith({ stones: 0, materials: { 'ruptura-rank-2': 1 } });
  assert.match(sellMaterial(cultivation, 'osso-de-lobo', 1).message, /não compra/);
  assert.match(sellMaterial(cultivation, 'ruptura-rank-9', 1).message, /não compra/);
  assert.match(sellMaterial(cultivation, 'ruptura-rank-2', 0).message, /Quantidade inválida/);
  assert.match(sellMaterial(cultivation, 'ruptura-rank-2', -2).message, /Quantidade inválida/);
  assert.match(sellMaterial(cultivation, 'ruptura-rank-2', 1.5).message, /Quantidade inválida/);
  assert.match(sellMaterial(cultivation, 'ruptura-rank-2', 2).message, /só tem 1/);
  assert.equal(cultivation.state.spiritStones, 0);
  assert.equal(cultivation.state.materials['ruptura-rank-2'], 1);
});

test('falha de gravação na venda não apaga o material nem credita pedras', () => {
  const { cultivation, storage } = cultivationWith({ stones: 0, materials: { 'ruptura-rank-1': 2 } });
  storage.failing = true;
  const result = sellMaterial(cultivation, 'ruptura-rank-1', 1);
  assert.equal(result.ok, false);
  assert.match(result.message, /nada foi alterado/);
  assert.equal(cultivation.state.spiritStones, 0);
  assert.equal(cultivation.state.materials['ruptura-rank-1'], 2);
});

test('métodos de gravação recusam valores inválidos sem alterar o estado', () => {
  const { cultivation } = cultivationWith({ stones: 50, materials: { 'ruptura-rank-1': 1 } });
  for (const amount of [0, -5, 1.5, 51, Number.NaN, Infinity]) {
    assert.equal(cultivation.spendStones(amount), false, `spendStones(${amount})`);
  }
  assert.equal(cultivation.state.spiritStones, 50);
  assert.equal(cultivation.spendStones(50), true);
  assert.equal(cultivation.state.spiritStones, 0);
  assert.equal(cultivation.spendStones(1), false);
  for (const [quantity, gain] of [[0, 10], [-1, 10], [2, 10], [1, 0], [1, -10], [1, 1.5]]) {
    assert.equal(cultivation.tradeMaterial('ruptura-rank-1', quantity, gain), false,
      `tradeMaterial(${quantity}, ${gain})`);
  }
  assert.equal(cultivation.tradeMaterial('ID inválido', 1, 5), false);
  assert.equal(cultivation.state.materials['ruptura-rank-1'], 1);
});

// ── Interface ──────────────────────────────────────────────────────────────
function vendorDom() {
  const html = readHtml();
  const ids = [...html.matchAll(/id="([a-z-]+)"/g)].map(match => match[1]);
  return { html, document: fakeDocument([...ids, 'vendor-feedback']) };
}

test('painel da banca existe no markup, é touch e abre só pelo vendedor', () => {
  const { html } = vendorDom();
  const css = readStyles();
  assert.match(html, /<aside id="vendor-panel"[^>]*hidden/);
  assert.match(html, /Banca do clã/);
  assert.match(html, /id="vendor-stock"/);
  assert.match(html, /id="vendor-materials"/);
  assert.match(css, /\.vendor-panel\s*\{[^}]*max-height:\s*calc\(100dvh/s);
  assert.match(css, /\.vendor-action\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.vendor-feedback\.is-error/);

  const main = sourceText('src/main.ts');
  assert.match(main, /new VendorPanel\(this\.cultivation, this\.combat\)/);
  assert.match(main, /definition\.id !== 'npc-jiang-ya'/);
  assert.match(main, /this\.vendorPanel\?\.open\(\)/);
  assert.match(main, /this\.vendorPanel\?\.destroy\(\)/);
  const npcView = sourceText('src/entities/npcView.ts');
  assert.match(npcView, /if \(onInteract\?\.\(definition\)\) return;/);
});

function sourceText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('banca renderiza estoque e materiais e permite comprar e vender pelo toque', () => {
  const { document } = vendorDom();
  const previousDocument = globalThis.document;
  globalThis.document = document;
  try {
    const { cultivation } = cultivationWith({ stones: 1000, materials: { 'ruptura-rank-1': 3 } });
    const { engine } = engineWith();
    const panel = new VendorPanel(cultivation, engine);
    const root = document.getElementById('vendor-panel');
    root.hidden = true; // o markup real abre fechado (atributo hidden)
    assert.equal(panel.isOpen, false);
    panel.open();
    assert.equal(root.hidden, false);
    assert.equal(panel.isOpen, true);
    assert.equal(document.getElementById('vendor-stones').textContent, '1000 pedras');
    const stock = document.getElementById('vendor-stock');
    assert.equal(stock.children.length, VENDOR_STOCK.length);
    const row = stock.children[0];
    const buyButton = row.children[row.children.length - 1];
    assert.ok(buyButton instanceof FakeElement);
    assert.match(buyButton.textContent, /Comprar · 650/);
    buyButton.click();
    assert.equal(cultivation.state.spiritStones, 350);
    assert.equal(document.getElementById('vendor-stones').textContent, '350 pedras');
    assert.match(document.getElementById('vendor-feedback').textContent, /comprada por 650 pedras/);
    assert.equal(document.getElementById('vendor-feedback').className, 'vendor-feedback is-ok');

    // Caro demais agora: o botão fica desabilitado e não cobra.
    const second = stock.children[1].children[stock.children[1].children.length - 1];
    assert.equal(second.disabled, true);
    second.click();
    assert.equal(cultivation.state.spiritStones, 350);

    const materials = document.getElementById('vendor-materials');
    assert.equal(materials.children.length, 1);
    const sellAll = materials.children[0].children[materials.children[0].children.length - 1];
    assert.match(sellAll.textContent, /Vender tudo · 24/);
    sellAll.click();
    assert.equal(cultivation.state.materials['ruptura-rank-1'], undefined);
    assert.equal(cultivation.state.spiritStones, 374);
    assert.match(materials.children[0].textContent ?? '', /Nenhum material/);
    panel.close();
    assert.equal(root.hidden, true);
    document.listeners.get('keydown')?.({ key: 'Escape' });
    panel.destroy();
    assert.equal(document.listeners.has('keydown'), false);
  } finally {
    globalThis.document = previousDocument;
  }
});
