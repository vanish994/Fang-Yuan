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

/** Ordem canônica: R1 Inicial → R1 Pico → R2 Inicial → ... → R9 Pico. */
export const CULTIVATION_COMBAT_STATES = Array.from({ length: 9 }, (_, index) =>
  (['Inicial', 'Médio', 'Superior', 'Pico'] as const).map(stage => ({ rank: index + 1, stage }))
).flat() as readonly { rank: number; stage: keyof typeof STAGE_POWER }[];
