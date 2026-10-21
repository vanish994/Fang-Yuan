import type { CultivationState } from './cultivation';

export interface CultivationCombatStats {
  maxHealth: number;
  attack: number;
  defense: number;
  maxEssence: number;
}

/**
 * Curva de poder dos 36 estados de cultivo.
 * O Rank é o salto principal; o estágio refina o poder dentro do Rank.
 * A defesa cresce de forma mais contida para evitar que uma diferença de
 * defesa transforme inimigos de Rank inferior em sacos de 1 de dano.
 */
const STAGE_POWER = {
  Inicial: 1,
  Médio: 1.08,
  Superior: 1.18,
  Pico: 1.30,
} as const;

const STAGE_ESSENCE_QUALITY = {
  Inicial: 1,
  Médio: 1.02,
  Superior: 1.05,
  Pico: 1.08,
} as const;

export function cultivationCombatStats(state: CultivationState): CultivationCombatStats {
  const rankFactor = Math.pow(1.42, state.rank - 1);
  const power = rankFactor * STAGE_POWER[state.stage];
  const stageIndex = { Inicial: 0, Médio: 1, Superior: 2, Pico: 3 }[state.stage];

  return {
    maxHealth: Math.max(1, Math.round(100 * power)),
    attack: Math.max(1, Math.round(14 * power)),
    defense: 2 + Math.floor((state.rank - 1) * 1.8) + Math.floor(stageIndex / 2),
    maxEssence: Math.max(1, Math.round(100 * (1 + (state.rank - 1) * 0.16 + stageIndex * 0.06))),
  };
}

/**
 * Qualidade da essência usada para alimentar um Gu.
 * Um Gu Rank 1 continua sendo Rank 1, mas a essência de um cultivador mais
 * forte o alimenta com maior potência. Isto fica separado do Rank do Gu para
 * permitir Gus Rank 2/3/... sem transformar automaticamente um Gu Rank 1 em
 * um Gu de Rank superior.
 */
export function primordialEssenceQualityMultiplier(state: CultivationState): number {
  const rankQuality = 1 + (state.rank - 1) * 0.08;
  return rankQuality * STAGE_ESSENCE_QUALITY[state.stage];
}
