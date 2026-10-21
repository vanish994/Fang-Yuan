import { GU_CATALOG } from '../combat/guCatalog';
import type { GuId, GuSlot } from '../combat/types';
import type { PlayerEffectStyle } from '../combat/characterCatalog';

/**
 * Formas de partícula enviadas em `gu-effects-4x4-32.png`: quatro linhas de quatro
 * quadros de 32px. A arte é um recorte claro/escuro (máscara), então a cor vem do
 * `visual.color` de cada Gu — o mesmo desenho serve para todos os efeitos do jogo.
 */
export type GuEffectShape = 'swirl' | 'slash' | 'smoke' | 'streak';

export const GU_EFFECT_SHAPES: readonly GuEffectShape[] = ['swirl', 'slash', 'smoke', 'streak'];

/**
 * Folha de gelo do Bai Ning Bing: mesmas quatro linhas, desenho diferente (espiral
 * de gelo, estilhaço em voo, explosão radial e onda). Também é máscara clara, então
 * a cor continua vindo do código — a arte do efeito não carrega tintura.
 */
export type IceEffectShape = 'frost' | 'shard' | 'burst' | 'wave';
export const ICE_EFFECT_SHAPES: readonly IceEffectShape[] = ['frost', 'shard', 'burst', 'wave'];
export const ICE_EFFECT_ROW: Readonly<Record<IceEffectShape, number>> = {
  frost: 0, shard: 1, burst: 2, wave: 3,
};

/** Folha e célula de cada estilo de partícula. */
export interface EffectSheet {
  texture: string;
  frameSize: number;
  shapes: readonly string[];
}
export const EFFECT_SHEETS: Readonly<Record<PlayerEffectStyle, EffectSheet>> = {
  gu: { texture: 'gu-effects', frameSize: 32, shapes: GU_EFFECT_SHAPES },
  ice: { texture: 'ice-effects', frameSize: 48, shapes: ICE_EFFECT_SHAPES },
};

/** Forma do estouro por estilo: ataque corta/estilhaça, movimento deixa rastro. */
export function effectShapeForStyle(style: PlayerEffectStyle, guId: GuId | null): string {
  if (style === 'ice') {
    if (!guId) return 'shard';
    const gu = GU_CATALOG[guId];
    if (gu.slot === 'movement') return 'wave';
    if (guId === 'ghost-fire' || guId === 'flash-blink') return 'frost';
    if (gu.slot === 'attack') return 'shard';
    return 'frost';
  }
  return guId ? effectShapeFor(guId) : 'swirl';
}

/** Quadros da forma na folha do estilo, na ordem em que a partícula deve animá-los. */
export function styleEffectFrames(style: PlayerEffectStyle, shape: string): number[] {
  const row = style === 'ice' ? ICE_EFFECT_ROW[shape as IceEffectShape] : GU_EFFECT_ROW[shape as GuEffectShape];
  if (row === undefined) return [0, 1, 2, 3];
  return Array.from({ length: GU_EFFECT_FRAMES_PER_SHAPE }, (_, index) => row * GU_EFFECT_FRAMES_PER_SHAPE + index);
}
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
export function effectScale(shape: string): number {
  if (shape === 'streak' || shape === 'wave') return 0.85;
  if (shape === 'smoke' || shape === 'frost') return 0.7;
  // Estilhaço e explosão ficam menores: a folha de gelo tem célula de 48px.
  if (shape === 'shard' || shape === 'burst') return 0.62;
  return 0.75;
}

/** Efeito de uma ação para um estilo de personagem, já com folha e quadros. */
export function effectForStyle(style: PlayerEffectStyle, guId: GuId | null,
  burst: GuEffectBurst, fallbackTint = 0xffffff): { texture: string; shape: string;
    frames: number[]; tint: number; scale: number; count: number } {
  const sheet = EFFECT_SHEETS[style];
  const shape = effectShapeForStyle(style, guId);
  return {
    texture: sheet.texture,
    shape,
    frames: styleEffectFrames(style, shape),
    // Sem Gu (básico à distância) a cor é a do personagem, nunca branco fixo.
    tint: guId ? effectTint(guId) : fallbackTint,
    scale: effectScale(shape),
    count: GU_EFFECT_COUNT[burst],
  };
}

/** Slot -> forma, usado nos testes para garantir cobertura de todas as linhas. */
export function shapesForSlot(slot: GuSlot): GuEffectShape[] {
  const ids = Object.keys(GU_CATALOG) as GuId[];
  return ids.filter(id => GU_CATALOG[id].slot === slot).map(effectShapeFor);
}
