import test from 'node:test';
import assert from 'node:assert/strict';

import { moduleURL } from './support/tsModule.mjs';

const catalogURL = moduleURL('combat/guCatalog');
const recipesURL = moduleURL('combat/guRecipes', { './guCatalog': catalogURL });
const viewURL = moduleURL('ui/recipeView');

const { GU_RECIPES } = await import(recipesURL);
const { recipeAvailability, recipeBlockReason, recipeRenderKey } = await import(viewURL);

const moonglow = GU_RECIPES.find(recipe => recipe.id === 'moonglow-rank-2');
const whiteJade = GU_RECIPES.find(recipe => recipe.id === 'white-jade-rank-2');

/** Estoque falso: mapa id → quantidade, com 0 para o resto. */
const ready = (overrides = {}) => objectContext({
  rank: 3, essence: 100,
  stock: { moonlight: 1, 'little-light': 2, 'jade-skin': 1, 'white-boar': 1 },
  ...overrides,
});

function objectContext(options) {
  const stock = new Map(Object.entries(options.stock ?? {}));
  return { rank: options.rank, essence: options.essence,
    alive: options.alive ?? true, inCombat: options.inCombat ?? false,
    stock: id => stock.get(id) ?? 0 };
}

test('receita exige Rank, ingredientes e essência ao mesmo tempo', () => {
  assert.equal(moonglow.requiresRank, 2);
  const full = ready();
  assert.deepEqual(recipeAvailability(moonglow, full),
    { canRank: true, canIngredients: true, canEssence: true, usable: true });
  assert.deepEqual(recipeAvailability(whiteJade, full),
    { canRank: true, canIngredients: true, canEssence: true, usable: true });

  assert.equal(recipeAvailability(moonglow, ready({ rank: 1 })).usable, false, 'Rank insuficiente');
  assert.equal(recipeAvailability(moonglow, ready({ stock: { moonlight: 1, 'little-light': 1 } })).usable,
    false, 'falta um Little Light');
  assert.equal(recipeAvailability(moonglow, ready({ essence: 29 })).usable, false, 'essência insuficiente');
  assert.equal(recipeAvailability(moonglow, ready({ essence: 30 })).usable, true, 'essência exata basta');
});

test('combate e morte bloqueiam o refino sem alterar os outros requisitos', () => {
  const inCombat = ready({ inCombat: true });
  const state = recipeAvailability(moonglow, inCombat);
  assert.equal(state.usable, false);
  assert.deepEqual([state.canRank, state.canIngredients, state.canEssence], [true, true, true],
    'o motivo do bloqueio continua sendo o combate');

  const dead = recipeAvailability(moonglow, ready({ alive: false }));
  assert.equal(dead.usable, false);
  assert.equal(dead.canIngredients, true);
});

test('motivo do bloqueio segue a ordem de resolução', () => {
  const order = [
    [ready({ rank: 1 }), 'Exige Rank 2'],
    [ready({ stock: {} }), 'Ingredientes insuficientes'],
    [ready({ essence: 0 }), 'Essência insuficiente'],
    [ready({ inCombat: true }), 'Indisponível agora (em combate ou derrotado)'],
    [ready({ alive: false }), 'Indisponível agora (em combate ou derrotado)'],
    [ready(), 'Executar receita determinística'],
  ];
  for (const [scenario, expected] of order) {
    assert.equal(recipeBlockReason(moonglow, recipeAvailability(moonglow, scenario)), expected);
  }
});

test('a chave de render não muda quando só a essência muda', () => {
  // Este é o ponto do bug: a essência regenera a cada quadro e, quando entrava
  // na reconstrução, destruía os botões ~60×/s (foco de teclado impossível).
  const base = ready({ essence: 0 });
  const key = recipeRenderKey(GU_RECIPES, base);
  for (const essence of [0, 1, 15, 29, 30, 31, 100, 2000]) {
    assert.equal(recipeRenderKey(GU_RECIPES, ready({ essence })), key, `essência ${essence}`);
  }
  // E a disponibilidade, sim, acompanha a essência.
  assert.equal(recipeAvailability(moonglow, ready({ essence: 29 })).canEssence, false);
  assert.equal(recipeAvailability(moonglow, ready({ essence: 30 })).canEssence, true);
});

test('a chave muda quando muda algo estrutural', () => {
  const base = recipeRenderKey(GU_RECIPES, ready());
  const variants = {
    'um ingrediente a mais': ready({ stock: { moonlight: 2, 'little-light': 2, 'jade-skin': 1, 'white-boar': 1 } }),
    'Rank maior': ready({ rank: 4 }),
    'em combate': ready({ inCombat: true }),
    'derrotado': ready({ alive: false }),
  };
  for (const [label, scenario] of Object.entries(variants)) {
    assert.notEqual(recipeRenderKey(GU_RECIPES, scenario), base, label);
  }
});

test('a chave distingue estoque de receitas diferentes', () => {
  const one = ready({ stock: { moonlight: 1, 'little-light': 2 } });
  const two = ready({ stock: { moonlight: 1, 'little-light': 2, 'jade-skin': 1 } });
  assert.notEqual(recipeRenderKey(GU_RECIPES, one), recipeRenderKey(GU_RECIPES, two));
  // O inverso: estoque irrelevante para todas as receitas não muda a chave.
  const irrelevant = ready({ stock: { moonlight: 1, 'little-light': 2, 'jade-skin': 1,
    'white-boar': 1, 'ghost-fire': 9 } });
  assert.equal(recipeRenderKey(GU_RECIPES, irrelevant),
    recipeRenderKey(GU_RECIPES, ready({ stock: { moonlight: 1, 'little-light': 2,
      'jade-skin': 1, 'white-boar': 1, 'ghost-fire': 3 } })),
    'gu industrial fora das receitas não força reconstrução');
});

test('estoque é lido com a mesma função usada pelo motor', () => {
  // A chave consulta `stock` para cada ingrediente de cada receita uma vez.
  const seen = [];
  const spy = {
    rank: 3, essence: 40, alive: true, inCombat: false,
    stock: id => { seen.push(id); return 5; },
  };
  recipeRenderKey(GU_RECIPES, spy);
  const expected = GU_RECIPES.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.id));
  assert.deepEqual(seen, expected);
});
