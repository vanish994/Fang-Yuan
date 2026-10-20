import { GU_CATALOG, isGuId } from './guCatalog';
import type { GuRecipe } from './types';

/**
 * Receitas determinísticas. As duas primeiras são canônicas na composição:
 * Moonglow = Moonlight + 2 Little Light (Rank 2) e White Jade = White Boar +
 * Jade Skin (Rank 2). Custo de essência e requisito de Rank são decisões do jogo.
 */
export const GU_RECIPES: readonly GuRecipe[] = [
  {
    id: 'moonglow-rank-2',
    name: 'Moonglow Gu · Rank 2',
    result: 'moonglow',
    resultQuantity: 1,
    ingredients: [
      { id: 'moonlight', quantity: 1 },
      { id: 'little-light', quantity: 2 },
    ],
    materials: [],
    essenceCost: 30,
    requiresRank: 2,
    successChance: 1,
    consumesIngredients: true,
    failureResult: 'none',
    fidelity: 'canonical',
    source: {
      reference: 'Reverend Insanity Wiki: Moonlight Gu / Moonglow Gu',
      effect: 'Moonlight Gu + 2 Little Light Gu = Moonglow Gu (Rank 2).',
      adaptation: 'O custo de 30 de essência, o requisito de Rank 2 e a produção determinística são regras do jogo.',
    },
  },
  {
    id: 'white-jade-rank-2',
    name: 'White Jade Gu · Rank 2',
    result: 'white-jade',
    resultQuantity: 1,
    ingredients: [
      { id: 'white-boar', quantity: 1 },
      { id: 'jade-skin', quantity: 1 },
    ],
    materials: [],
    essenceCost: 30,
    requiresRank: 2,
    successChance: 1,
    consumesIngredients: true,
    failureResult: 'none',
    fidelity: 'canonical',
    source: {
      reference: 'Reverend Insanity Wiki: White Boar Gu / Jade Skin Gu / White Jade Gu',
      effect: 'White Boar Gu + Jade Skin Gu = White Jade Gu (Rank 2).',
      adaptation: 'O custo de 30 de essência, o requisito de Rank 2 e a produção determinística são regras do jogo.',
    },
  },
];

export const RECIPES_BY_ID: Readonly<Record<string, GuRecipe>> = Object.freeze(
  Object.fromEntries(GU_RECIPES.map(recipe => [recipe.id, recipe])),
);

export function recipeById(id: string): GuRecipe | undefined {
  return Object.prototype.hasOwnProperty.call(RECIPES_BY_ID, id) ? RECIPES_BY_ID[id] : undefined;
}

/** Validação estática usada por typecheck/testes; falha cedo se um ID ou Rank divergir. */
export function validateRecipes(): readonly string[] {
  const problems: string[] = [];
  for (const recipe of GU_RECIPES) {
    const result = GU_CATALOG[recipe.result];
    if (!result) problems.push(`${recipe.id}: resultado desconhecido`);
    if (recipe.resultQuantity <= 0) problems.push(`${recipe.id}: quantidade inválida`);
    if (!Number.isSafeInteger(recipe.essenceCost) || recipe.essenceCost < 0) {
      problems.push(`${recipe.id}: custo de essência inválido`);
    }
    if (recipe.successChance !== 1) problems.push(`${recipe.id}: a primeira versão exige sucesso determinístico`);
    for (const ingredient of recipe.ingredients) {
      if (!isGuId(ingredient.id) || ingredient.quantity <= 0) {
        problems.push(`${recipe.id}: ingrediente inválido`);
      }
      if (GU_CATALOG[ingredient.id]?.rank >= result.rank) {
        problems.push(`${recipe.id}: ingrediente de Rank igual ou superior ao resultado`);
      }
    }
  }
  return problems;
}
