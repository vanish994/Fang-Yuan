import type { GuId, GuRecipe } from '../combat/types';

/**
 * Regras de exibição das receitas, separadas do DOM para poderem ser testadas.
 *
 * A essência regenera a cada quadro, então ela **não** entra na chave de render:
 * os cards são reconstruídos só quando muda algo estrutural (estoque, Rank,
 * morte, entrar/sair de combate) e a disponibilidade do botão é atualizada
 * sem tocar na árvore. Antes disso, cada quadro destruía os botões e o foco de
 * teclado nunca sobrevivia na lista de receitas.
 */
export interface RecipeContext {
  rank: number;
  essence: number;
  stock: (id: GuId) => number;
  alive: boolean;
  inCombat: boolean;
}

export interface RecipeAvailability {
  canRank: boolean;
  canIngredients: boolean;
  canEssence: boolean;
  usable: boolean;
}

export function recipeAvailability(recipe: GuRecipe, context: RecipeContext): RecipeAvailability {
  const canRank = context.rank >= recipe.requiresRank;
  const canIngredients = recipe.ingredients.every(ingredient =>
    context.stock(ingredient.id) >= ingredient.quantity);
  const canEssence = context.essence >= recipe.essenceCost;
  return {
    canRank,
    canIngredients,
    canEssence,
    usable: canRank && canIngredients && canEssence && context.alive && !context.inCombat,
  };
}

/** Texto do `title` do botão, na ordem em que o jogador deve resolver o bloqueio. */
export function recipeBlockReason(recipe: GuRecipe, availability: RecipeAvailability): string {
  if (!availability.canRank) return `Exige Rank ${recipe.requiresRank}`;
  if (!availability.canIngredients) return 'Ingredientes insuficientes';
  if (!availability.canEssence) return 'Essência insuficiente';
  if (!availability.usable) return 'Indisponível agora (em combate ou derrotado)';
  return 'Executar receita determinística';
}

/**
 * Chave de reconstrução dos cards. Exclui `essence` de propósito; inclui apenas
 * o que muda texto/estrutura: Rank, estado do herói e estoque de cada ingrediente.
 */
export function recipeRenderKey(recipes: readonly GuRecipe[], context: RecipeContext): string {
  const stock = recipes.map(recipe => `${recipe.id}:${
    recipe.ingredients.map(ingredient => `${ingredient.id}=${context.stock(ingredient.id)}`).join(',')
  }`).join(';');
  return `${context.rank}|${context.alive ? 'vivo' : 'morto'}|${context.inCombat ? 'combate' : 'livre'}|${stock}`;
}
