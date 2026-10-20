import { GU_CATALOG } from '../combat/guCatalog';
import type { GuId, GuSlot } from '../combat/types';

/**
 * Formas de partícula enviadas em `gu-effects-4x4-32.png`: quatro linhas de quatro
 * quadros de 32px. A arte é um recorte claro/escuro (máscara), então a cor vem do
 * `visual.color` de cada Gu — o mesmo desenho serve para todos os efeitos do jogo.
 */
export type GuEffectShape = 'swirl' | 'slash' | 'smoke' | 'streak';

export const GU_EFFECT_SHAPES: readonly GuEffectShape[] = ['swirl', 'slash', 'smoke', 'streak'];
export const GU_EFFECT_FRAMES_PER_SHAPE = 4;

/** Linha de cada forma na folha (0 = topo). */
export const GU_EFFECT_ROW: Readonly<Record<GuEffectShape, number>> = {
  swirl: 0, slash: 1, smoke: 2, streak: 3,
};

/**
 * Forma por função do Gu: ataque corta, movimento deixa rastro, apoio gira em
 * volta do corpo e maldição (fogo fantasma/clarão) solta fumaça.
 */
export function effectShapeFor(guId: GuId): GuEffectShape {
  const gu = GU_CATALOG[guId];
  if (gu.slot === 'movement') return 'streak';
  if (guId === 'ghost-fire' || guId === 'flash-blink') return 'smoke';
  if (gu.slot === 'attack') return 'slash';
  return 'swirl';
}

/** Quadros da forma na folha, na ordem em que a partícula deve animá-los. */
export function effectFrames(shape: GuEffectShape): number[] {
  const first = GU_EFFECT_ROW[shape] * GU_EFFECT_FRAMES_PER_SHAPE;
  return Array.from({ length: GU_EFFECT_FRAMES_PER_SHAPE }, (_, index) => first + index);
}

/** Cor do efeito: a mesma cor registrada no catálogo para o Gu. */
export function effectTint(guId: GuId): number {
  const parsed = Number.parseInt(GU_CATALOG[guId].visual.color.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

/** Quantidade de partículas por tipo de estouro, medida para não poluir a tela. */
export type GuEffectBurst = 'cast' | 'dash' | 'defeat' | 'death';

export const GU_EFFECT_COUNT: Readonly<Record<GuEffectBurst, number>> = {
  cast: 7, dash: 10, defeat: 6, death: 8,
};

export function effectForGu(guId: GuId): { shape: GuEffectShape; frames: number[]; tint: number } {
  const shape = effectShapeFor(guId);
  return { shape, frames: effectFrames(shape), tint: effectTint(guId) };
}

/** Escala de cada forma: o rastro do movimento é mais aberto que a fumaça. */
export function effectScale(shape: GuEffectShape): number {
  return shape === 'streak' ? 0.85 : shape === 'smoke' ? 0.7 : 0.75;
}

/** Slot -> forma, usado nos testes para garantir cobertura de todas as linhas. */
export function shapesForSlot(slot: GuSlot): GuEffectShape[] {
  const ids = Object.keys(GU_CATALOG) as GuId[];
  return ids.filter(id => GU_CATALOG[id].slot === slot).map(effectShapeFor);
}
